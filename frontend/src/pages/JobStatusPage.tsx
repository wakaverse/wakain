import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { getJob, subscribeJobProgress } from '../lib/api';
import type { Job, PhaseLog } from '../types';

/** Ordered list of all pipeline phases. */
const PHASES = [
  'P1_STT', 'P2_SCAN', 'P3_EXTRACT',
  'P4_CLASSIFY', 'P5_TEMPORAL', 'P6_SCENE',
  'P7_PRODUCT', 'P8_VISUAL', 'P9_ENGAGE',
  'P10_SCRIPT', 'P11_MERGE', 'P12_BUILD', 'P13_EVALUATE',
] as const;

const PHASE_LABELS: Record<string, { ko: string; en: string }> = {
  P1_STT:       { ko: '음성 인식',     en: 'Speech-to-Text' },
  P2_SCAN:      { ko: '영상 스캔',     en: 'Video Scan' },
  P3_EXTRACT:   { ko: '프레임 추출',   en: 'Frame Extract' },
  P4_CLASSIFY:  { ko: '장면 분류',     en: 'Scene Classify' },
  P5_TEMPORAL:  { ko: '시간 분석',     en: 'Temporal Analysis' },
  P6_SCENE:     { ko: '씬 구성',       en: 'Scene Build' },
  P7_PRODUCT:   { ko: '제품 분석',     en: 'Product Analysis' },
  P8_VISUAL:    { ko: '비주얼 분석',   en: 'Visual Analysis' },
  P9_ENGAGE:    { ko: '몰입도 분석',   en: 'Engagement Analysis' },
  P10_SCRIPT:   { ko: '스크립트 분석', en: 'Script Analysis' },
  P11_MERGE:    { ko: '데이터 통합',   en: 'Data Merge' },
  P12_BUILD:    { ko: '레시피 생성',   en: 'Recipe Build' },
  P13_EVALUATE: { ko: '코칭 평가',     en: 'Coaching Evaluation' },
};

/** Per-phase state derived from SSE events. */
interface PhaseState {
  status: 'pending' | 'running' | 'success' | 'fail';
  duration_ms: number | null;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function JobStatusPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [job, setJob] = useState<Job | null>(null);
  const [phases, setPhases] = useState<Record<string, PhaseState>>({});
  const [sseConnected, setSseConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // Initial job fetch
  useEffect(() => {
    if (!id) return;
    getJob(id).then(setJob).catch(() => {});
  }, [id]);

  // SSE subscription
  useEffect(() => {
    if (!id || !job) return;
    if (job.status === 'completed' || job.status === 'failed') return;

    let cancelled = false;

    subscribeJobProgress(id, (event) => {
      if (cancelled) return;

      if (event.type === 'phase') {
        const p = event as PhaseLog;
        setPhases((prev) => ({
          ...prev,
          [p.phase_name]: { status: p.status, duration_ms: p.duration_ms },
        }));
      } else if (event.type === 'done') {
        // Refresh job to get final status
        getJob(id).then((updated) => {
          setJob(updated);
          if (updated.status === 'completed') {
            setTimeout(() => navigate(`/app/results/${id}`), 1200);
          }
        }).catch(() => {});
        esRef.current?.close();
      }
    }).then((es) => {
      if (cancelled) { es.close(); return; }
      esRef.current = es;
      setSseConnected(true);
    }).catch(() => {});

    return () => {
      cancelled = true;
      esRef.current?.close();
      esRef.current = null;
    };
  }, [id, job?.status, navigate]);

  // Fallback polling if SSE not connected after 5s
  useEffect(() => {
    if (!id || !job || sseConnected) return;
    if (job.status === 'completed' || job.status === 'failed') return;

    const timer = setTimeout(() => {
      if (sseConnected) return;
      // Fallback: poll job status
      const interval = setInterval(async () => {
        try {
          const data = await getJob(id);
          setJob(data);
          if (data.status === 'completed') {
            clearInterval(interval);
            setTimeout(() => navigate(`/app/results/${id}`), 800);
          }
          if (data.status === 'failed') clearInterval(interval);
        } catch { /* ignore */ }
      }, 3000);
      return () => clearInterval(interval);
    }, 5000);

    return () => clearTimeout(timer);
  }, [id, job, sseConnected, navigate]);

  const lang = i18n.language === 'ko' ? 'ko' : 'en';

  // Count completed phases
  const completedCount = Object.values(phases).filter((p) => p.status === 'success').length;
  const hasPhaseData = Object.keys(phases).length > 0;

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Failed state
  if (job.status === 'failed') {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-24 text-center">
        <div className="bg-white border border-gray-200 rounded-2xl p-10 shadow-sm">
          <div className="w-14 h-14 bg-red-50 border border-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('jobStatus.failed_title')}</h2>
          <p className="text-gray-500 text-sm mb-6">
            {job.error_message || t('jobStatus.failed_desc')}
          </p>
          <Link
            to={`${lang === 'ko' ? '' : `/${lang}`}/analyze`}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t('jobStatus.retry')}
          </Link>
        </div>
      </div>
    );
  }

  // Completed state
  if (job.status === 'completed') {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-24 text-center">
        <div className="bg-white border border-gray-200 rounded-2xl p-10 shadow-sm">
          <div className="w-14 h-14 bg-green-50 border border-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-7 h-7 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('jobStatus.completed_title')}</h2>
          <p className="text-gray-500 text-sm">{t('jobStatus.completed_desc')}</p>
        </div>
      </div>
    );
  }

  // Processing / Pending state — phase stepper
  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-12">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-gray-900">
            {t('jobStatus.processing_title')}
          </h2>
          {hasPhaseData && (
            <p className="text-sm text-gray-400 mt-1">
              {completedCount} / {PHASES.length} {lang === 'ko' ? '단계 완료' : 'phases done'}
            </p>
          )}
        </div>

        {/* Progress bar */}
        {hasPhaseData && (
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((completedCount / PHASES.length) * 100)}%` }}
            />
          </div>
        )}

        {/* Phase stepper */}
        {hasPhaseData ? (
          <div className="space-y-1">
            {PHASES.map((phaseName) => {
              const state = phases[phaseName];
              const label = PHASE_LABELS[phaseName]?.[lang] || phaseName;

              if (!state) {
                // Phase not started yet — show dimmed
                return (
                  <div key={phaseName} className="flex items-center gap-3 py-1.5 px-2 rounded-lg">
                    <div className="w-5 h-5 rounded-full border-2 border-gray-200 shrink-0" />
                    <span className="text-sm text-gray-300">{label}</span>
                  </div>
                );
              }

              return (
                <div
                  key={phaseName}
                  className={`flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors ${
                    state.status === 'running' ? 'bg-blue-50' : ''
                  }`}
                >
                  {/* Status icon */}
                  <div className="shrink-0">
                    {state.status === 'running' && (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    )}
                    {state.status === 'success' && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    )}
                    {state.status === 'fail' && (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>

                  {/* Label */}
                  <span className={`text-sm flex-1 ${
                    state.status === 'running' ? 'text-blue-700 font-medium' :
                    state.status === 'success' ? 'text-gray-600' :
                    'text-red-600'
                  }`}>
                    {label}
                  </span>

                  {/* Duration */}
                  {state.status === 'success' && state.duration_ms !== null && (
                    <span className="text-xs text-gray-400">
                      {formatDuration(state.duration_ms)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* No SSE data yet — simple waiting state */
          <p className="text-center text-sm text-gray-400">
            {t('jobStatus.processing_desc')}
          </p>
        )}

        {/* Video name */}
        {job.video_name && (
          <div className="mt-6 pt-5 border-t border-gray-100 text-left">
            <p className="text-xs text-gray-400 mb-1">{t('jobStatus.video_label')}</p>
            <p className="text-sm text-gray-700 font-medium truncate">{job.video_name}</p>
          </div>
        )}
      </div>
    </div>
  );
}
