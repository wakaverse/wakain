import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, Clock, Layers, Monitor, Film } from 'lucide-react';
import { getResult } from '../lib/api';
import type { VideoRecipe } from '../types';
import AppealSection from '../components/Report/AppealSection';
import AttentionChart from '../components/Report/AttentionChart';
import SceneTimeline from '../components/Report/SceneTimeline';
import Metrics from '../components/Report/Metrics';
import Suggestions from '../components/Report/Suggestions';

const ratingLabels: Record<string, { label: string; color: string }> = {
  strong:   { label: '강함',   color: 'text-green-400' },
  moderate: { label: '보통',   color: 'text-yellow-400' },
  weak:     { label: '약함',   color: 'text-red-400' },
};

function RatingBadge({ rating }: { rating: string }) {
  const cfg = ratingLabels[rating] ?? { label: rating, color: 'text-gray-400' };
  return <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>;
}

const categoryLabels: Record<string, string> = {
  food: '식품',
  fashion: '패션',
  beauty: '뷰티',
  tech: '테크',
  health: '건강',
  home: '홈/리빙',
};

const platformLabels: Record<string, string> = {
  shorts: 'YouTube Shorts',
  tiktok: 'TikTok',
  reels: 'Instagram Reels',
};

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<VideoRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getResult(id)
      .then(setRecipe)
      .catch(() => setError('결과를 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-red-400 mb-4">{error || '결과를 찾을 수 없습니다.'}</p>
        <Link to="/dashboard" className="text-blue-400 hover:text-blue-300 text-sm">
          대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  const r = recipe.video_recipe;
  const { meta, persuasion_analysis, scenes, dropoff_analysis, performance_metrics, effectiveness_assessment } = r;

  const effectivenessItems = [
    { label: '훅 강도', value: effectiveness_assessment.hook_rating },
    { label: '흐름', value: effectiveness_assessment.flow_rating },
    { label: '메시지 명확성', value: effectiveness_assessment.message_clarity },
    { label: 'CTA 강도', value: effectiveness_assessment.cta_strength },
    { label: '재시청 요소', value: effectiveness_assessment.replay_factor },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      {/* Back */}
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        대시보드
      </Link>

      {/* ────── Header ────── */}
      <div className="mb-10 pb-8 border-b border-gray-800">
        <div className="flex flex-wrap items-start gap-3 mb-4">
          <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-full border border-blue-500/20">
            {platformLabels[meta.platform] ?? meta.platform}
          </span>
          <span className="px-2.5 py-1 bg-gray-800 text-gray-400 text-xs font-medium rounded-full">
            {categoryLabels[meta.category] ?? meta.category}
          </span>
          {meta.sub_category && (
            <span className="px-2.5 py-1 bg-gray-800 text-gray-400 text-xs font-medium rounded-full">
              {meta.sub_category}
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">영상 분석 리포트</h1>

        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock className="w-4 h-4 text-gray-600" />
            <span>{meta.duration}초</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Layers className="w-4 h-4 text-gray-600" />
            <span>{scenes.length}개 씬</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Film className="w-4 h-4 text-gray-600" />
            <span>{r.visual_style.total_cuts}회 컷</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Monitor className="w-4 h-4 text-gray-600" />
            <span>{meta.aspect_ratio}</span>
          </div>
        </div>

        {/* Effectiveness overview */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
          {effectivenessItems.map((item) => (
            <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <RatingBadge rating={item.value} />
            </div>
          ))}
        </div>

        {/* Target audience */}
        {meta.target_audience && (
          <div className="mt-4 p-4 bg-gray-900 border border-gray-800 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">타겟 오디언스</p>
            <p className="text-sm text-gray-300">{meta.target_audience}</p>
          </div>
        )}

        {/* Hook line */}
        {r.audio?.voice?.hook_line && (
          <div className="mt-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
            <p className="text-xs text-blue-400 mb-1">훅 라인</p>
            <p className="text-white font-medium">"{r.audio.voice.hook_line}"</p>
          </div>
        )}
      </div>

      {/* ────── Sections ────── */}
      <div className="space-y-14">

        {/* 소구 분석 */}
        <AppealSection
          appealPoints={persuasion_analysis.appeal_points}
          primaryAppeal={persuasion_analysis.primary_appeal}
          appealLayering={persuasion_analysis.appeal_layering}
          persuasionSummary={persuasion_analysis.persuasion_summary}
        />

        {/* 집중도 차트 */}
        <AttentionChart
          scenes={scenes}
          riskZones={dropoff_analysis.risk_zones}
          safeZones={dropoff_analysis.safe_zones}
          overallRetentionScore={dropoff_analysis.overall_retention_score}
        />

        {/* 씬 타임라인 */}
        <SceneTimeline
          scenes={scenes}
          totalDuration={meta.duration}
        />

        {/* 퍼포먼스 메트릭 */}
        <Metrics metrics={performance_metrics} />

        {/* 개선 제안 */}
        <Suggestions
          dropoffAnalysis={dropoff_analysis}
          effectiveness={effectiveness_assessment}
        />

        {/* 구조 요약 */}
        <section>
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-blue-400">🎨</span> 아트 디렉션
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 mb-2">톤 앤 매너</p>
              <p className="text-white font-medium">{r.art_direction.tone_and_manner}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 mb-2">그래픽 스타일</p>
              <p className="text-white font-medium">{r.art_direction.graphic_style}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 mb-3">브랜드 컬러</p>
              <div className="flex gap-2 flex-wrap">
                {r.art_direction.brand_colors.map((c, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-lg border border-gray-700 shadow" style={{ backgroundColor: c }} />
                    <span className="text-xs text-gray-600 font-mono">{c}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 mb-2">레퍼런스 스타일</p>
              <p className="text-sm text-gray-300 leading-relaxed">{r.art_direction.style_reference}</p>
            </div>
          </div>

          {/* Visual palette */}
          {r.visual_style.color_palette?.length > 0 && (
            <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 mb-3">영상 컬러 팔레트</p>
              <div className="flex gap-2">
                {r.visual_style.color_palette.map((c, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className="w-12 h-12 rounded-lg border border-gray-700"
                      style={{ backgroundColor: c }}
                    />
                    <span className="text-xs text-gray-600 font-mono">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Audio summary */}
        <section>
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-blue-400">🎵</span> 오디오 전략
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 mb-2">배경음악</p>
              <p className="text-white font-medium">{r.audio.music.genre}</p>
              <p className="text-xs text-gray-500 mt-1">{r.audio.music.bpm_range} BPM · {r.audio.music.energy_profile}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 mb-2">보이스</p>
              <p className="text-white font-medium">{r.audio.voice.type}</p>
              <p className="text-xs text-gray-500 mt-1">{r.audio.voice.tone} · {r.audio.voice.language}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:col-span-1 col-span-full">
              <p className="text-xs text-gray-500 mb-2">스크립트 요약</p>
              <p className="text-sm text-gray-300 leading-relaxed">{r.audio.voice.script_summary}</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
