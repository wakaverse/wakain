import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { getResult } from '../lib/api';
import type { AnalysisResult } from '../types';
import VideoPlayer, { type VideoPlayerHandle } from '../components/Report/VideoPlayer';
import DimensionChart from '../components/Report/DimensionChart';
import AppealAnalysis from '../components/Report/AppealAnalysis';
import ArtDirectionPanel from '../components/Report/ArtDirectionPanel';
import DiagnosisTab from '../components/Report/DiagnosisTab';
import PersuasionStructure from '../components/Report/PersuasionStructure';
import AppealTimelineBar from '../components/Report/AppealTimelineBar';

type TabId = 'structure' | 'diagnosis' | 'art';

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'structure', label: '영상 구조', icon: '🎯' },
  { id: 'diagnosis', label: '개선 의견', icon: '💡' },
  { id: 'art', label: '아트 디렉션', icon: '🎨' },
];

const formatLabels: Record<string, string> = {
  talking_head: '진행자형', caption_text: '캡션/텍스트형', product_demo: '데모/언박싱형',
  ugc_vlog: 'UGC/브이로그형', asmr_mood: 'ASMR/무드형', comparison: '비교형',
  listicle: '리스트형', story_problem: '스토리/문제해결형', entertainment: '엔터형',
};

const intentLabels: Record<string, string> = {
  commerce: '커머스/세일즈', information: '정보 전달', branding: '브랜딩/이미지',
  entertainment: '엔터테인먼트',
};

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('structure');
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef<VideoPlayerHandle>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getResult(id)
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSeek = useCallback((time: number) => {
    playerRef.current?.seekTo(time);
  }, []);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600">분석 결과 로딩 중...</span>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-red-600 mb-4">{error || '결과를 찾을 수 없습니다'}</p>
        <Link to="/" className="text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> 돌아가기
        </Link>
      </div>
    );
  }

  // Extract recipe data
  const recipeData = result.video_recipe?.video_recipe || result.video_recipe || {};
  const meta = (recipeData as any).meta || {};
  const duration = meta.duration || 30;
  const videoUrl = result.video_url || null;

  // Diagnosis data (from Phase 7) — supports both old (integrated_analyzer) and new (diagnosis_engine)
  const diagnosis = result.diagnosis || {} as any;
  const dimensions = diagnosis.dimensions || [];
  const engagementScore = diagnosis.overall_score || diagnosis.engagement_score || 0;
  const classification = diagnosis.classification || {};
  const sceneAnalyses = diagnosis.scene_analyses || [];

  // Style
  const style = result.style || classification;
  const narration = (style as any).narration_type || classification.narration_type || '?';

  // Art direction
  const artDirection = (recipeData as any).art_direction || {};

  const narrationLabel = narration === 'voice' ? '🎤 음성' : narration === 'caption' ? '📝 캡션' : '🔇 무음';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {result.verdict?.product_name || meta.category || '영상'} 분석 리포트
            </h1>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {result.verdict?.product_name && (
                <span className="px-2 py-0.5 bg-gray-100 rounded-full font-medium text-gray-700">
                  🏷️ {result.verdict.product_name}
                  {result.verdict.product_category ? ` · ${result.verdict.product_category}` : ''}
                </span>
              )}
              <span>{narrationLabel}</span>
              <span>{duration}초</span>
            </div>
          </div>
          {/* 종합 점수 뱃지 */}
          {engagementScore > 0 && (
            <div className="ml-auto text-center">
              <div className="text-2xl font-bold text-blue-600">{Math.round(engagementScore)}</div>
              <div className="text-[10px] text-gray-400">종합</div>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 좌측: 영상 + 타임라인바 + 5차원 차트 */}
          <div className="lg:w-[360px] lg:shrink-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
            <VideoPlayer ref={playerRef} src={videoUrl} onTimeUpdate={handleTimeUpdate} />
            {result.appeal_structure && (
              <AppealTimelineBar
                groups={result.appeal_structure.groups}
                scenes={result.appeal_structure.scenes}
                duration={duration}
                currentTime={currentTime}
                onSeek={handleSeek}
              />
            )}
            {dimensions.length > 0 && (
              <DimensionChart dimensions={dimensions} engagementScore={engagementScore} />
            )}
          </div>

          {/* 우측: 탭 콘텐츠 */}
          <div className="flex-1 min-w-0">
            {/* 탭 네비게이션 */}
            <div className="flex gap-1 bg-white rounded-xl p-1 border mb-4 sticky top-16 z-20">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 text-sm font-medium py-2.5 px-3 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* 탭 콘텐츠 */}
            <div className="bg-white rounded-xl border p-5">
              {activeTab === 'structure' && (
                result.appeal_structure ? (
                  <PersuasionStructure
                    appealStructure={result.appeal_structure}
                    sceneCards={(recipeData as any).scenes || []}
                    stt={result.stt}
                    onSeek={handleSeek}
                    currentTime={currentTime}
                    recipe={result.video_recipe as unknown as Record<string, unknown>}
                  />
                ) : (
                  <AppealAnalysis
                    scenes={sceneAnalyses}
                    duration={duration}
                    onSeek={handleSeek}
                    currentTime={currentTime}
                    hookAnalysis={(diagnosis as any)?.hook_analysis || null}
                  />
                )
              )}
              {activeTab === 'diagnosis' && (
                <DiagnosisTab
                  verdict={result.verdict}
                  prescriptions={result.prescriptions}
                  diagnosis={(result.diagnosis as any)?.axes ? result.diagnosis as any : null}
                  overallScore={engagementScore}
                  onSeek={handleSeek}
                />
              )}
              {activeTab === 'art' && (
                <ArtDirectionPanel art={artDirection} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
