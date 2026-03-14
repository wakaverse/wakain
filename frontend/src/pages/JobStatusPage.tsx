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


/** Per-phase state derived from SSE events. */
interface PhaseState {
  status: 'pending' | 'running' | 'success' | 'fail';
  duration_ms: number | null;
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
              {Math.round((completedCount / PHASES.length) * 100)}% {lang === 'ko' ? '완료' : 'complete'}
            </p>
          )}
        </div>

        {/* Progress bar */}
        {hasPhaseData && (
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((completedCount / PHASES.length) * 100)}%` }}
            />
          </div>
        )}

        {/* Simple status message — no pipeline details */}
        {hasPhaseData ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">
              {completedCount < PHASES.length
                ? (lang === 'ko' ? '영상을 분석하고 있습니다. 잠시만 기다려주세요...' : 'Analyzing your video. Please wait...')
                : (lang === 'ko' ? '분석이 거의 완료되었습니다!' : 'Almost done!')}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {lang === 'ko' ? '보통 2~3분 정도 소요됩니다' : 'Usually takes 2-3 minutes'}
            </p>
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
