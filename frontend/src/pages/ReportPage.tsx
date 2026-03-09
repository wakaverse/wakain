import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import { getResult, addLibraryItem } from '../lib/api';
import type { RecipeJSON } from '../types/recipe';
import type { LibraryItem } from '../types';
import SummarySection from '../components/Report/SummarySection';
import EvaluationSection from '../components/Report/EvaluationSection';
import StructureSection from '../components/Report/StructureSection';
import ProductSection from '../components/Report/ProductSection';
import { formatTime, BLOCK_LABELS, BLOCK_EVAL_COLORS } from '../lib/recipe-utils';

/* ── Main Component ───────────────────────── */

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<RecipeJSON | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getResult(id)
      .then((data) => {
        setRecipe(data.recipe);
        setVideoUrl(data.video_url);
        setThumbnails(data.thumbnails);
        // Add to library
        if (data.recipe) {
          addLibraryItem({
            platform: data.recipe.meta?.platform || 'instagram',
            source: 'analysis',
            original_url: data.video_url || '',
            video_url: data.video_url || '',
            title: data.recipe.product?.name || data.recipe.identity?.name || 'Analysis',
            thumbnail_url: '',
            job_id: id,
            tags: data.recipe.product?.category ? [data.recipe.product.category] : [],
          } as Partial<LibraryItem>).catch(() => {});
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const seekTo = useCallback((sec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = sec;
      videoRef.current.play();
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">{error || '결과를 찾을 수 없습니다'}</p>
      </div>
    );
  }

  // V1 fallback: recipe without schema_version is V1
  const schemaVersion = (recipe as unknown as Record<string, unknown>).schema_version as string | undefined;
  if (!schemaVersion || schemaVersion !== '2.0') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <RefreshCw className="w-7 h-7 text-gray-400" />
        </div>
        <p className="text-lg font-semibold text-gray-900 mb-2">이전 버전(V1) 분석 결과</p>
        <p className="text-sm text-gray-500 mb-6 max-w-md">
          이 분석은 이전 버전(V1)으로 수행되었습니다.<br />
          V2 분석을 위해 영상을 다시 업로드해주세요.
        </p>
        <button
          onClick={() => navigate('/app/analyze')}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          재분석하기
        </button>
      </div>
    );
  }

  const hasEvaluation = !!recipe.evaluation;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="lg:flex lg:gap-6">
        {/* Left column: Video + Product info */}
        <div className="lg:w-[340px] lg:shrink-0">
          <div className="lg:sticky lg:top-4">
            {videoUrl && (
              <div className="mb-4 rounded-2xl overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="w-full lg:max-h-[600px] max-h-[400px] object-contain"
                />
              </div>
            )}
            {/* Product info */}
            <div className="flex items-center gap-2 text-sm mb-3">
              <span className="font-medium text-gray-900">{recipe.product.name}</span>
              {recipe.product.category_ko && (
                <span className="text-gray-400">· {recipe.product.category_ko}</span>
              )}
              {recipe.product.brand && (
                <span className="text-gray-400">· {recipe.product.brand}</span>
              )}
            </div>

            {/* Desktop: Recipe flow summary */}
            <div className="hidden lg:block">
              <RecipeFlowSummary recipe={recipe} />
            </div>
          </div>
        </div>

        {/* Right column: Single view */}
        <div className="flex-1 min-w-0">
          {/* Mobile: Recipe flow summary */}
          <div className="lg:hidden">
            <RecipeFlowSummary recipe={recipe} />
          </div>

          <div className="space-y-6">
            {/* 1. Evaluation (coaching) or fallback to Summary */}
            {hasEvaluation ? (
              <EvaluationSection data={recipe} />
            ) : (
              <SummarySection data={recipe} />
            )}

            {/* 2. Structure (energy graph + block bar + coaching) */}
            <StructureSection data={recipe} seekTo={seekTo} />

            {/* 3. Scene cards (with utterances) */}
            <SceneCards recipe={recipe} seekTo={seekTo} thumbnails={thumbnails} />

            {/* 4. Product */}
            <ProductSection data={recipe} seekTo={seekTo} />

            {/* 5. Recipe card (current → suggestion) */}
            <RecipeCard recipe={recipe} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Recipe flow summary (sidebar) ──────────── */

function RecipeFlowSummary({ recipe }: { recipe: RecipeJSON }) {
  const flowOrder = recipe.script?.flow_order;
  if (!flowOrder?.length) return null;

  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs text-gray-400">레시피</span>
        {flowOrder.map((el, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-xs text-gray-600">{BLOCK_LABELS[el] || el}</span>
            {i < flowOrder.length - 1 && <span className="text-gray-300 text-[10px]">→</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Scene cards — grouped by script block ──── */

function getScenesForBlock(
  scenes: RecipeJSON['visual']['scenes'],
  blockStart: number,
  blockEnd: number,
) {
  return scenes.filter((s) => {
    return s.time_range[0] < blockEnd && s.time_range[1] > blockStart;
  });
}

function SceneCards({ recipe, seekTo, thumbnails }: {
  recipe: RecipeJSON;
  seekTo: (s: number) => void;
  thumbnails: Record<string, string>;
}) {
  const scenes = recipe.visual.scenes;
  const blocks = recipe.script.blocks;

  if (!blocks.length) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-gray-900">씬 분석</p>
      {blocks.map((block, bi) => {
        const color = BLOCK_EVAL_COLORS[block.block] || '#6B7280';
        const matchedScenes = getScenesForBlock(scenes, block.time_range[0], block.time_range[1]);

        return (
          <div
            key={bi}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
          >
            {/* Header: block type tag + time range */}
            <div
              className="flex items-center gap-2 px-4 py-2.5 cursor-pointer"
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
            </div>

            {/* Thumbnail strip */}
            {matchedScenes.length > 0 && (
              <div className="flex gap-1 px-4 pb-2 overflow-x-auto">
                {matchedScenes.map((scene) => (
                  <button
                    key={scene.scene_id}
                    className="w-20 h-14 rounded-lg bg-gray-50 shrink-0 overflow-hidden hover:ring-2 hover:ring-offset-1 transition-all relative group"
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
                ))}
              </div>
            )}

            {/* Utterances / block text */}
            <div className="px-4 pb-3 border-t border-gray-50 pt-2">
              {block.utterances?.length ? (
                <div className="space-y-1">
                  {block.utterances.map((u, ui) => (
                    <p key={ui} className="text-xs text-gray-600 leading-relaxed">
                      <span className="text-[10px] text-gray-400 font-mono mr-1">
                        {formatTime(u.time_range[0])}
                      </span>
                      {u.text}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 leading-relaxed">
                  {block.text}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Recipe card (current → suggestion) ────── */

function RecipeCard({ recipe }: { recipe: RecipeJSON }) {
  const [copied, setCopied] = useState(false);
  const flowOrder = recipe.script.flow_order;
  const recipeEval = recipe.evaluation?.recipe_eval;

  if (!flowOrder?.length) return null;

  const recipeText = flowOrder.map(b => BLOCK_LABELS[b] || b).join(' → ');

  const handleCopy = () => {
    navigator.clipboard.writeText(recipeText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-sm font-semibold text-gray-900 mb-3">레시피</p>

      {/* Current recipe */}
      <div className="bg-[#fafafa] rounded-xl px-4 py-3 mb-3">
        <div className="text-[10px] text-gray-400 mb-1.5">현재</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {flowOrder.map((block, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${BLOCK_EVAL_COLORS[block] || '#6B7280'}18`,
                  color: BLOCK_EVAL_COLORS[block] || '#6B7280',
                }}
              >
                {BLOCK_LABELS[block] || block}
              </span>
              {i < flowOrder.length - 1 && (
                <span className="text-gray-300 text-xs">→</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Suggestion (if evaluation exists) */}
      {recipeEval && (
        <div className="bg-blue-50 rounded-xl px-4 py-3 mb-3">
          <div className="text-[10px] text-blue-500 mb-1.5">제안</div>
          <p className="text-sm text-blue-800 leading-relaxed">{recipeEval.suggestion}</p>
          <p className="text-xs text-blue-600 mt-1">{recipeEval.reason}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-xs font-medium rounded-xl hover:bg-gray-800 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? '복사됨' : '레시피 복사'}
        </button>
      </div>
    </div>
  );
}
