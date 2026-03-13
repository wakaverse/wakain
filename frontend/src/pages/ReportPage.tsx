import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, Pencil } from 'lucide-react';
import { getResult, addLibraryItem } from '../lib/api';
import type { RecipeJSON } from '../types/recipe';
import type { LibraryItem } from '../types';
import VideoSummaryCard from '../components/Report/VideoSummaryCard';
import HookAnalysisCard from '../components/Report/HookAnalysisCard';
import PositioningCard from '../components/Report/PositioningCard';
import ProductClaimsCard from '../components/Report/ProductClaimsCard';
import CoachingCard from '../components/Report/CoachingCard';
import UnifiedTimeline from '../components/Report/UnifiedTimeline';
import CollapsibleSection from '../components/Report/CollapsibleSection';

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

  return (
    <div className="max-w-6xl mx-auto">
      <div className="lg:flex lg:gap-6">
        {/* Left column: Video */}
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
          </div>
        </div>

        {/* Right column: Cards in order */}
        <div className="flex-1 min-w-0">
          <div className="space-y-3">
            {/* 제작가이드 버튼 */}
            <div className="flex justify-end">
              <button
                onClick={() => navigate(`/app/guide/${id}`)}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-900 text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                제작가이드
              </button>
            </div>

            {/* 1. 영상 요약 — 항상 열림 */}
            <VideoSummaryCard data={recipe} />

            {/* 2. 콘텐츠 포지셔닝 */}
            <CollapsibleSection
              title="콘텐츠 포지셔닝"
              summary={recipe.evaluation?.positioning?.unique_angle || ''}
              defaultOpen={false}
            >
              <PositioningCard data={recipe} />
            </CollapsibleSection>

            {/* 3. 훅 분석 */}
            <CollapsibleSection
              title="훅 분석"
              summary={`훅 강도: ${recipe.evaluation?.hook_analysis?.strength || '-'}`}
              defaultOpen={false}
            >
              <HookAnalysisCard data={recipe} />
            </CollapsibleSection>

            {/* 4. 통합 타임라인 (설득 흐름 + 시각 변화량 + 씬 분석 병합) */}
            <CollapsibleSection
              title="통합 타임라인"
              summary="설득 흐름 · 시각 변화량 · 씬 분석"
              defaultOpen={false}
            >
              <UnifiedTimeline data={recipe} seekTo={seekTo} thumbnails={thumbnails} />
            </CollapsibleSection>

            {/* 7. 제품 소구 분석 */}
            <CollapsibleSection
              title="제품 소구 분석"
              summary={`소구점 ${recipe.product?.claims?.length || 0}개`}
              defaultOpen={false}
            >
              <ProductClaimsCard data={recipe} />
            </CollapsibleSection>

            {/* 8. 코칭 */}
            <CollapsibleSection
              title="코칭"
              summary={recipe.evaluation?.summary ? recipe.evaluation.summary.slice(0, 50) + '...' : ''}
              defaultOpen={false}
            >
              <CoachingCard data={recipe} />
            </CollapsibleSection>
          </div>
        </div>
      </div>
    </div>
  );
}
