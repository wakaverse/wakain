import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import { getResult, addLibraryItem } from '../lib/api';
import type { RecipeJSON } from '../types/recipe';
import type { LibraryItem } from '../types';
import SummarySection from '../components/Report/SummarySection';
import ProductSection from '../components/Report/ProductSection';
import ScriptSection from '../components/Report/ScriptSection';
import VisualSection from '../components/Report/VisualSection';
import EngagementSection from '../components/Report/EngagementSection';
import AttentionCurveSection from '../components/Report/AttentionCurveSection';
import { formatTime, BLOCK_LABELS } from '../lib/recipe-utils';

/* ── Main Component ───────────────────────── */

type Tab = 'analysis' | 'scenes';

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<RecipeJSON | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('analysis');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getResult(id)
      .then((data) => {
        setRecipe(data.recipe);
        setVideoUrl(data.video_url);
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

        {/* Right column: Analysis results */}
        <div className="flex-1 min-w-0">
          {/* Mobile: Recipe flow summary */}
          <div className="lg:hidden">
            <RecipeFlowSummary recipe={recipe} />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
            <TabButton active={tab === 'analysis'} onClick={() => setTab('analysis')}>분석 결과</TabButton>
            <TabButton active={tab === 'scenes'} onClick={() => setTab('scenes')}>씬 뷰</TabButton>
          </div>

          {/* Tab content */}
          {tab === 'analysis' && (
            <AnalysisTab recipe={recipe} seekTo={seekTo} />
          )}
          {tab === 'scenes' && (
            <ScenesTab recipe={recipe} seekTo={seekTo} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Tab button ─────────────────────────────── */

function TabButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
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

/* ── Tab: 분석 결과 ─────────────────────────── */

function AnalysisTab({ recipe, seekTo }: {
  recipe: RecipeJSON; seekTo: (s: number) => void;
}) {
  return (
    <div className="space-y-4">
      <SummarySection data={recipe} />
      <ProductSection data={recipe} seekTo={seekTo} />
      <ScriptSection data={recipe} seekTo={seekTo} />
      <VisualSection data={recipe} seekTo={seekTo} />

      {/* Engagement */}
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-3">인게이지먼트</p>
        <EngagementSection data={recipe} seekTo={seekTo} />
      </div>

      <AttentionCurveSection data={recipe} />

      {/* Recipe action card */}
      <RecipeActionCard recipe={recipe} />
    </div>
  );
}

/* ── Tab: 씬 뷰 (V2 scenes) ────────────────── */

function ScenesTab({ recipe, seekTo }: {
  recipe: RecipeJSON; seekTo: (s: number) => void;
}) {
  const scenes = recipe.visual.scenes;
  const duration = recipe.meta.duration;

  return (
    <div className="space-y-4">
      {/* Attention curve chart */}
      <AttentionCurveSection data={recipe} />

      {/* Timeline overview */}
      {duration > 0 && scenes.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-0.5 overflow-x-auto pb-2">
            {scenes.map((scene) => {
              const dur = scene.time_range[1] - scene.time_range[0];
              const pct = (dur / duration) * 100;
              return (
                <button
                  key={scene.scene_id}
                  onClick={() => seekTo(scene.time_range[0])}
                  className="h-7 rounded bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center text-[9px] text-gray-500 font-mono shrink-0"
                  style={{ minWidth: '24px', width: `${Math.max(pct, 3)}%` }}
                  title={`${formatTime(scene.time_range[0])}–${formatTime(scene.time_range[1])}${scene.role ? ` (${scene.role})` : ''}`}
                >
                  {scene.role || scene.scene_id}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-gray-300 mt-1 px-0.5">
            <span>0:00</span>
            <span>{formatTime(duration)}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {recipe.visual.rhythm.total_cuts}컷 · 평균 {recipe.visual.rhythm.avg_cut_duration.toFixed(1)}초/컷
          </p>
        </div>
      )}

      {/* Scene cards */}
      {scenes.map((scene) => (
        <div
          key={scene.scene_id}
          className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-gray-200 transition-colors cursor-pointer group"
          onClick={() => seekTo(scene.time_range[0])}
        >
          <div className="flex items-start gap-3">
            <div className="w-24 h-16 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-gray-200">
                {String(scene.scene_id).padStart(2, '0')}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-mono text-gray-400">
                  {formatTime(scene.time_range[0])}–{formatTime(scene.time_range[1])}
                </span>
                {scene.role && (
                  <span className="text-[10px] font-medium px-2 py-0.5 bg-gray-900 text-white rounded-full">
                    {scene.role}
                  </span>
                )}
                {scene.style && (
                  <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                    {scene.style}
                  </span>
                )}
              </div>
              {scene.description && (
                <p className="text-sm text-gray-700 leading-relaxed mb-1.5">{scene.description}</p>
              )}
              {scene.visual_forms.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {scene.visual_forms.map((f, j) => (
                    <span key={j} className="text-[10px] px-2 py-0.5 bg-gray-50 text-gray-500 rounded-full">
                      {f.form}({f.method})
                    </span>
                  ))}
                </div>
              )}
              <div className="text-[10px] text-gray-400 mt-1">
                {scene.production.dominant_shot_type} · {scene.production.dominant_color_tone}
              </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <span className="text-xs text-gray-400">▶</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Recipe action card ─────────────────────── */

function RecipeActionCard({ recipe }: {
  recipe: RecipeJSON;
}) {
  const [copied, setCopied] = useState(false);
  const flowOrder = recipe.script.flow_order;

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
      <div className="bg-[#fafafa] rounded-xl px-4 py-3 mb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {flowOrder.map((block, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-800">
                {BLOCK_LABELS[block] || block}
              </span>
              {i < flowOrder.length - 1 && (
                <span className="text-gray-300 text-xs">→</span>
              )}
            </span>
          ))}
        </div>
      </div>
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
