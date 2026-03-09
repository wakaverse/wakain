import type { RecipeJSON } from '../../types/recipe';
import { formatTime, BLOCK_LABELS, BLOCK_EVAL_COLORS } from '../../lib/recipe-utils';

interface Props {
  data: RecipeJSON;
  seekTo: (sec: number) => void;
  thumbnails: Record<string, string>;
}

// Alpha Korean labels (task-specific translations)
const ALPHA_EMOTION_KO: Record<string, string> = {
  relief: '안심감',
  pride: '자부심',
  empathy: '공감',
  anticipation: '기대감',
  curiosity: '호기심',
  fomo: '놓칠까봐',
  desire: '갖고싶음',
};

const ALPHA_STRUCTURE_KO: Record<string, string> = {
  problem_solution: '문제→해결',
  contrast: '대비',
  before_after: '전후비교',
  info_density: '정보전달',
  demonstration: '시연',
};

const ALPHA_CONNECTION_KO: Record<string, string> = {
  question_answer: '질문→답변',
  bridge_sentence: '연결',
  direct_address: '직접호소',
};

const ALPHA_MAPS: Record<string, Record<string, string>> = {
  emotion: ALPHA_EMOTION_KO,
  structure: ALPHA_STRUCTURE_KO,
  connection: ALPHA_CONNECTION_KO,
};

const ALPHA_COLORS: Record<string, { bg: string; text: string }> = {
  emotion: { bg: 'bg-pink-50', text: 'text-pink-700' },
  structure: { bg: 'bg-sky-50', text: 'text-sky-700' },
  connection: { bg: 'bg-amber-50', text: 'text-amber-700' },
};

function getScenesForBlock(
  scenes: RecipeJSON['visual']['scenes'],
  blockStart: number,
  blockEnd: number,
) {
  return scenes.filter((s) => s.time_range[0] < blockEnd && s.time_range[1] > blockStart);
}

export default function SceneAnalysisCard({ data, seekTo, thumbnails }: Props) {
  const scenes = data.visual.scenes;
  const blocks = data.script.blocks;

  if (!blocks.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">씬 분석</p>

      <div className="space-y-3">
        {blocks.map((block, bi) => {
          const color = BLOCK_EVAL_COLORS[block.block] || '#6B7280';
          const matchedScenes = getScenesForBlock(scenes, block.time_range[0], block.time_range[1]);

          return (
            <div
              key={bi}
              className="rounded-xl border border-gray-100 overflow-hidden"
            >
              {/* Header: block tag + time + alpha badges */}
              <div
                className="flex items-center gap-2 px-4 py-2.5 cursor-pointer flex-wrap"
                style={{ borderLeft: `3px solid ${color}` }}
                onClick={() => seekTo(block.time_range[0])}
              >
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
                {block.alpha && (
                  <div className="flex gap-1 flex-wrap">
                    {Object.entries(block.alpha).map(([dim, val]) => {
                      if (!val) return null;
                      const map = ALPHA_MAPS[dim];
                      const colors = ALPHA_COLORS[dim];
                      const label = map?.[val] || val;
                      return (
                        <span
                          key={dim}
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${colors?.bg || 'bg-gray-50'} ${colors?.text || 'text-gray-600'}`}
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Thumbnail strip + scene production info */}
              {matchedScenes.length > 0 && (
                <div className="px-4 pb-2">
                  <div className="flex gap-1 overflow-x-auto">
                    {matchedScenes.map((scene) => (
                      <div key={scene.scene_id} className="shrink-0">
                        <button
                          className="w-20 h-14 rounded-lg bg-gray-50 overflow-hidden hover:ring-2 hover:ring-offset-1 transition-all relative group"
                          style={{ '--tw-ring-color': color } as React.CSSProperties}
                          onClick={() => seekTo(scene.time_range[0])}
                        >
                          {thumbnails[String(scene.scene_id)] ? (
                            <img src={thumbnails[String(scene.scene_id)]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-gray-200 flex items-center justify-center h-full">
                              {String(scene.scene_id).padStart(2, '0')}
                            </span>
                          )}
                          <span className="absolute bottom-0 inset-x-0 bg-black/50 text-[9px] text-white text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {formatTime(scene.time_range[0])}
                          </span>
                        </button>
                        {/* Production info */}
                        <div className="flex gap-1 mt-1 justify-center">
                          {scene.production?.dominant_shot_type && (
                            <span className="text-[9px] text-gray-400">
                              {scene.production.dominant_shot_type}
                            </span>
                          )}
                          {scene.production?.dominant_color_tone && (
                            <span className="text-[9px] text-gray-400">
                              {scene.production.dominant_color_tone}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Visual forms for matched scenes */}
                  {matchedScenes.some((s) => s.visual_forms?.length > 0) && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {matchedScenes.flatMap((s) =>
                        (s.visual_forms || []).map((vf, vi) => (
                          <span
                            key={`${s.scene_id}-${vi}`}
                            className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded"
                          >
                            {vf.form} · {vf.method}
                          </span>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Utterances / block text */}
              <div className="px-4 pb-3 border-t border-gray-50 pt-2">
                {block.utterances?.length ? (
                  <div className="space-y-1">
                    {block.utterances.map((u, ui) => (
                      <p key={ui} className="text-sm text-gray-600 leading-relaxed">
                        <span className="text-[10px] text-gray-400 font-mono mr-1">
                          {formatTime(u.time_range[0])}
                        </span>
                        {u.text}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 leading-relaxed">{block.text}</p>
                )}

                {/* Product claim ref */}
                {block.product_claim_ref && (
                  <p className="text-xs text-blue-600 mt-1.5">
                    📦 소구: {block.product_claim_ref}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
