import type { RecipeJSON } from '../../types/recipe';
import { formatTime, BLOCK_LABELS, BLOCK_EVAL_COLORS, CLAIM_TYPE_INFO } from '../../lib/recipe-utils';

interface Props {
  blockIndex: number;
  data: RecipeJSON;
  seekTo: (sec: number) => void;
  thumbnails: Record<string, string>;
  onClose: () => void;
}

const ALPHA_LABELS: Record<string, Record<string, string>> = {
  emotion: { relief: '안심감', pride: '자부심', empathy: '공감', anticipation: '기대감', curiosity: '호기심', fomo: '놓칠까봐', desire: '갖고싶음' },
  structure: { problem_solution: '문제→해결', contrast: '대비', before_after: '전후비교', info_density: '정보전달', demonstration: '시연' },
  connection: { question_answer: '질문→답변', bridge_sentence: '연결', direct_address: '직접호소' },
};

const ALPHA_COLORS: Record<string, { bg: string; text: string }> = {
  emotion: { bg: 'bg-pink-50', text: 'text-pink-700' },
  structure: { bg: 'bg-sky-50', text: 'text-sky-700' },
  connection: { bg: 'bg-amber-50', text: 'text-amber-700' },
};

function getScenesForBlock(scenes: RecipeJSON['visual']['scenes'], start: number, end: number) {
  return scenes.filter((s) => s.time_range[0] < end && s.time_range[1] > start);
}

export default function TimelineDetail({ blockIndex, data, seekTo, thumbnails, onClose }: Props) {
  const block = data.script.blocks[blockIndex];
  if (!block) return null;

  const color = BLOCK_EVAL_COLORS[block.block] || '#6B7280';
  const scenes = getScenesForBlock(data.visual.scenes, block.time_range[0], block.time_range[1]);

  // Find improvements matching this block's scenes
  const blockSceneIds = new Set(block.matched_scenes || []);
  const improvements = (data.evaluation?.improvements || []).filter((imp) => {
    return imp.related_scenes?.some((sid) => blockSceneIds.has(sid));
  });

  // Find claims matching this time range
  const claims = (data.product?.claims || []).filter((c) => {
    return c.time_range[0] < block.time_range[1] && c.time_range[1] > block.time_range[0];
  });

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-2 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${color}18`, color }}
          >
            {BLOCK_LABELS[block.block] || block.block}
          </span>
          <span className="text-[11px] font-mono text-gray-400">
            {formatTime(block.time_range[0])}–{formatTime(block.time_range[1])}
          </span>
          {/* Alpha badges */}
          {block.alpha && Object.entries(block.alpha).map(([dim, val]) => {
            if (!val) return null;
            const label = ALPHA_LABELS[dim]?.[val] || val;
            const c = ALPHA_COLORS[dim];
            return (
              <span key={dim} className={`text-[10px] px-1.5 py-0.5 rounded-full ${c?.bg || 'bg-gray-50'} ${c?.text || 'text-gray-600'}`}>
                {label}
              </span>
            );
          })}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm px-1">✕</button>
      </div>

      {/* Script text */}
      <p className="text-sm text-gray-700 leading-relaxed mb-3">{block.text}</p>

      {/* Scene thumbnails */}
      {scenes.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5">씬</p>
          <div className="flex gap-2 overflow-x-auto">
            {scenes.map((scene) => (
              <div key={scene.scene_id} className="shrink-0">
                <button
                  className="w-24 h-16 rounded-lg bg-gray-100 overflow-hidden hover:ring-2 hover:ring-offset-1 transition-all relative group"
                  style={{ '--tw-ring-color': color } as React.CSSProperties}
                  onClick={() => seekTo(scene.time_range[0])}
                >
                  {thumbnails[String(scene.scene_id)] ? (
                    <img src={thumbnails[String(scene.scene_id)]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-gray-300 flex items-center justify-center h-full">
                      {String(scene.scene_id).padStart(2, '0')}
                    </span>
                  )}
                  <span className="absolute bottom-0 inset-x-0 bg-black/50 text-[9px] text-white text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatTime(scene.time_range[0])}
                  </span>
                </button>
                <div className="flex gap-1 mt-1 justify-center flex-wrap">
                  {scene.production?.dominant_shot_type && (
                    <span className="text-[9px] text-gray-400">{scene.production.dominant_shot_type}</span>
                  )}
                  {scene.production?.dominant_color_tone && (
                    <span className="text-[9px] text-gray-400">{scene.production.dominant_color_tone}</span>
                  )}
                </div>
                {/* Visual forms */}
                {scene.visual_forms?.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5 justify-center flex-wrap">
                    {scene.visual_forms.map((vf, vi) => (
                      <span key={vi} className="text-[9px] px-1 bg-gray-100 text-gray-400 rounded">
                        {vf.form}·{vf.method}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claims in this range */}
      {claims.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5">소구점</p>
          <div className="space-y-1">
            {claims.map((c, ci) => {
              const info = CLAIM_TYPE_INFO[c.type];
              return (
                <div key={ci} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <span>{info?.icon || '📌'}</span>
                  <span>{c.claim}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Coaching suggestions */}
      {improvements.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5">코칭 제안</p>
          <div className="space-y-1">
            {improvements.map((imp, ii) => (
              <p key={ii} className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
                {imp.suggestion}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
