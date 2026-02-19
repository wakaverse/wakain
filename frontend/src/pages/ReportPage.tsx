import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { getResult } from '../lib/api';
import type { VideoRecipe } from '../types';
import OverallDiagnosis from '../components/Report/OverallDiagnosis';
import AttentionChart from '../components/Report/AttentionChart';
import AppealFlow from '../components/Report/AppealFlow';
import Metrics from '../components/Report/Metrics';
import Suggestions from '../components/Report/Suggestions';
import SceneTimeline from '../components/Report/SceneTimeline';

const categoryLabels: Record<string, string> = {
  food: '식품', fashion: '패션', beauty: '뷰티',
  tech: '테크', health: '건강', home: '홈/리빙',
};

const platformLabels: Record<string, string> = {
  shorts: 'YouTube Shorts', tiktok: 'TikTok', reels: 'Instagram Reels',
};

const ratingLabels: Record<string, { label: string; color: string; bg: string }> = {
  strong:   { label: '강함', color: 'text-green-700', bg: 'bg-green-50'  },
  moderate: { label: '보통', color: 'text-amber-700', bg: 'bg-amber-50'  },
  weak:     { label: '약함', color: 'text-red-700',   bg: 'bg-red-50'    },
};

function RatingBadge({ rating }: { rating: string }) {
  const cfg = ratingLabels[rating] ?? { label: rating, color: 'text-gray-600', bg: 'bg-gray-50' };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function DetailAccordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {open && <div className="px-5 pb-5 bg-white border-t border-gray-100">{children}</div>}
    </div>
  );
}

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
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-red-600 mb-4 text-sm">{error || '결과를 찾을 수 없습니다.'}</p>
        <Link to="/dashboard" className="text-blue-600 hover:text-blue-700 text-sm">
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
    { label: '메시지', value: effectiveness_assessment.message_clarity },
    { label: 'CTA', value: effectiveness_assessment.cta_strength },
    { label: '재시청', value: effectiveness_assessment.replay_factor },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      {/* Back */}
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        대시보드
      </Link>

      {/* ─── Report header ─── */}
      <div className="mb-8 pb-6 border-b border-gray-100">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">
            {platformLabels[meta.platform] ?? meta.platform}
          </span>
          <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
            {categoryLabels[meta.category] ?? meta.category}
          </span>
          {meta.sub_category && (
            <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
              {meta.sub_category}
            </span>
          )}
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-4">영상 분석 리포트</h1>

        {/* Quick stats */}
        <div className="flex flex-wrap gap-5 text-sm text-gray-500 mb-5">
          <span>{meta.duration}초</span>
          <span className="text-gray-200">·</span>
          <span>{scenes.length}개 씬</span>
          <span className="text-gray-200">·</span>
          <span>{r.visual_style.total_cuts}회 컷</span>
          <span className="text-gray-200">·</span>
          <span>{meta.aspect_ratio}</span>
        </div>

        {/* Effectiveness quick row */}
        <div className="flex flex-wrap gap-3">
          {effectivenessItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">{item.label}</span>
              <RatingBadge rating={item.value} />
            </div>
          ))}
        </div>

        {/* Hook line */}
        {r.audio?.voice?.hook_line && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs text-blue-500 mb-0.5">훅 라인</p>
            <p className="text-gray-900 font-medium text-sm">"{r.audio.voice.hook_line}"</p>
          </div>
        )}
      </div>

      {/* ─── SECTION 1: 종합 진단 ─── */}
      <OverallDiagnosis
        effectiveness={effectiveness_assessment}
        metrics={performance_metrics}
        retentionScore={dropoff_analysis.overall_retention_score}
        firstAppealTime={performance_metrics.time_to_first_appeal}
      />

      {/* ─── Main content sections ─── */}
      <div className="space-y-10">

        {/* SECTION 2: 집중도 타임라인 */}
        <AttentionChart
          scenes={scenes}
          riskZones={dropoff_analysis.risk_zones}
          safeZones={dropoff_analysis.safe_zones}
          overallRetentionScore={dropoff_analysis.overall_retention_score}
        />

        {/* SECTION 3: 소구 흐름 */}
        <AppealFlow
          appealPoints={persuasion_analysis.appeal_points}
          primaryAppeal={persuasion_analysis.primary_appeal}
          appealLayering={persuasion_analysis.appeal_layering}
          persuasionSummary={persuasion_analysis.persuasion_summary}
        />

        {/* SECTION 4: 핵심 지표 */}
        <Metrics metrics={performance_metrics} />

        {/* SECTION 5: 개선 제안 */}
        <Suggestions
          dropoffAnalysis={dropoff_analysis}
          effectiveness={effectiveness_assessment}
        />

        {/* SECTION 6: 상세 분석 (collapsed by default) */}
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3">상세 분석</h2>
          <div className="space-y-2">

            {/* 씬 상세 */}
            <DetailAccordion title="씬 상세">
              <div className="pt-4">
                <SceneTimeline scenes={scenes} totalDuration={meta.duration} />
              </div>
            </DetailAccordion>

            {/* 아트 디렉션 */}
            <DetailAccordion title="아트 디렉션">
              <div className="pt-4 grid sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1.5">톤 앤 매너</p>
                  <p className="text-sm text-gray-800 font-medium">{r.art_direction.tone_and_manner}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1.5">그래픽 스타일</p>
                  <p className="text-sm text-gray-800 font-medium">{r.art_direction.graphic_style}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-2">브랜드 컬러</p>
                  <div className="flex gap-2 flex-wrap">
                    {r.art_direction.brand_colors.map((c, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded-lg border border-gray-200 shadow-sm" style={{ backgroundColor: c }} />
                        <span className="text-xs text-gray-400 font-mono">{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1.5">레퍼런스 스타일</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{r.art_direction.style_reference}</p>
                </div>
                {r.visual_style.color_palette?.length > 0 && (
                  <div className="sm:col-span-2 bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-2">영상 컬러 팔레트</p>
                    <div className="flex gap-2">
                      {r.visual_style.color_palette.map((c, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <div className="w-12 h-12 rounded-lg border border-gray-200" style={{ backgroundColor: c }} />
                          <span className="text-xs text-gray-400 font-mono">{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </DetailAccordion>

            {/* 오디오 */}
            <DetailAccordion title="오디오 전략">
              <div className="pt-4 grid sm:grid-cols-3 gap-3">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1.5">배경음악</p>
                  <p className="text-sm text-gray-800 font-medium">{r.audio.music.genre}</p>
                  <p className="text-xs text-gray-400 mt-1">{r.audio.music.bpm_range} BPM · {r.audio.music.energy_profile}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1.5">보이스</p>
                  <p className="text-sm text-gray-800 font-medium">{r.audio.voice.type}</p>
                  <p className="text-xs text-gray-400 mt-1">{r.audio.voice.tone} · {r.audio.voice.language}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1.5">스크립트 요약</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{r.audio.voice.script_summary}</p>
                </div>
              </div>
            </DetailAccordion>

          </div>
        </section>

      </div>
    </div>
  );
}
