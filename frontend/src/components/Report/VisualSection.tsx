import { useState } from 'react';
import { Film, ChevronDown, Video } from 'lucide-react';
import type { RecipeJSON } from '../../types/recipe';
import { STYLE_COLORS, STYLE_LABELS, ENERGY_LABELS, formatTimeRange, labelKo } from '../../lib/recipe-utils';

interface Props {
  data: RecipeJSON;
  seekTo: (sec: number) => void;
  thumbnails?: Record<string, string>;
}

export default function VisualSection({ data, seekTo, thumbnails = {} }: Props) {
  const [expanded, setExpanded] = useState(false);
  const scenes = data.visual.scenes;
  const rhythm = data.visual.rhythm;

  if (!scenes?.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-emerald-500" />
          <p className="text-sm font-semibold text-gray-900">영상 축</p>
          <span className="text-xs text-gray-400">({scenes.length}씬)</span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
        >
          {expanded ? '접기' : '펼치기'}
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Rhythm summary */}
      {rhythm && (
        <div className="mb-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>리듬: {rhythm.cut_rhythm}</span>
            <span>템포: {rhythm.tempo_level}</span>
            <span>아크: {labelKo(rhythm.attention_arc, ENERGY_LABELS)}</span>
            <span>{rhythm.total_cuts}컷 · {rhythm.avg_cut_duration.toFixed(1)}초/컷</span>
          </div>
        </div>
      )}

      {/* Scene list */}
      {expanded ? (
        <div className="space-y-0">
          {scenes.map((s) => (
            <div
              key={s.scene_id}
              className="flex gap-3 py-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => seekTo(s.time_range[0])}
            >
              {thumbnails[String(s.scene_id)] ? (
                <img
                  src={thumbnails[String(s.scene_id)]}
                  alt={`씬 ${s.scene_id}`}
                  className="w-16 h-10 rounded object-cover shrink-0"
                />
              ) : (
                <div className="w-16 h-10 rounded bg-gray-100 flex items-center justify-center shrink-0">
                  <Video className="w-4 h-3 text-gray-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="text-[11px] font-mono text-gray-400">
                    {formatTimeRange(s.time_range)}
                  </span>
                  {s.style && <StyleTag style={s.style} />}
                  {s.role && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600">
                      {s.role}
                    </span>
                  )}
                </div>
                {s.visual_forms.length > 0 && (
                  <div className="text-[11px] text-gray-500 mb-0.5">
                    {s.visual_forms.map((f) => `${f.form}(${f.method})`).join(' + ')}
                  </div>
                )}
                {s.description && (
                  <div className="text-[11px] text-gray-400">{s.description}</div>
                )}
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {s.production.dominant_shot_type} · {s.production.dominant_color_tone} · 텍스트 {s.production.text_usage}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {scenes.filter((s) => s.style).map((s) => (
            <div
              key={s.scene_id}
              className="flex items-center gap-2 py-1 text-xs cursor-pointer hover:bg-gray-50 rounded transition-colors px-1"
              onClick={() => seekTo(s.time_range[0])}
            >
              <span className="font-mono text-gray-400 text-[11px] w-16 shrink-0">
                {formatTimeRange(s.time_range).split('-')[0]}
              </span>
              {s.style && <StyleTag style={s.style} />}
              {s.role && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600">
                  {s.role}
                </span>
              )}
              <span className="text-gray-400 text-[11px] truncate">
                {s.visual_forms.length > 0 ? s.visual_forms[0].form : ''}
              </span>
            </div>
          ))}
          {scenes.filter((s) => !s.style).length > 0 && (
            <div className="text-[11px] text-gray-400 pt-1">
              + {scenes.filter((s) => !s.style).length}개 미분류 씬
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StyleTag({ style }: { style: string }) {
  const c = STYLE_COLORS[style] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${c.bg} ${c.text}`}>
      {labelKo(style, STYLE_LABELS)}
    </span>
  );
}
