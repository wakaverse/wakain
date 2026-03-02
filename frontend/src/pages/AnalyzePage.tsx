import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileVideo, AlertCircle, Link2, Loader2, Filter, ChevronRight, Upload } from 'lucide-react';
import { createJob, createJobFromUrl, listJobs, getJobStatus } from '../lib/api';
import { compressTo480p } from '../lib/videoCompress';
import { showToast } from '../hooks/useToast';
import type { Job } from '../types';
import SEOHead from '../components/SEOHead';

const MAX_SIZE = 200 * 1024 * 1024;
const ACCEPTED_TYPES = { 'video/mp4': ['.mp4'], 'video/quicktime': ['.mov'], 'video/webm': ['.webm'] };
const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}초 전`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

function isTimedOut(job: Job): boolean {
  if (job.status !== 'processing' && job.status !== 'pending') return false;
  const created = new Date(job.created_at).getTime();
  return Date.now() - created > TIMEOUT_MS;
}

function getEffectiveStatus(job: Job): string {
  if (isTimedOut(job)) return 'failed';
  return job.status;
}

type Phase = 'idle' | 'compressing' | 'uploading' | 'starting' | 'downloading';
type JobFilter = 'all' | 'processing' | 'completed' | 'failed';

export default function AnalyzePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Inline input state
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);

  // Job list state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobFilter, setJobFilter] = useState<JobFilter>('all');
  const pollingRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const timeoutNotifiedRef = useRef<Set<string>>(new Set());

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    setError('');
    if (rejected.length > 0) {
      const err = rejected[0].errors[0];
      setError(err.message.includes('size') ? t('analyze.error_size') : t('analyze.error_format'));
      return;
    }
    if (accepted.length > 0) {
      handleFileSubmit(accepted[0]);
    }
  }, [t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: ACCEPTED_TYPES, maxSize: MAX_SIZE, multiple: false,
  });

  // Fetch jobs
  const fetchJobs = useCallback(async () => {
    try {
      const data = await listJobs();
      setJobs(data);
    } catch {
      // ignore
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Poll processing jobs with timeout check
  useEffect(() => {
    const processingJobs = jobs.filter((j) => j.status === 'processing' || j.status === 'pending');

    pollingRef.current.forEach((interval, id) => {
      if (!processingJobs.find((j) => j.id === id)) {
        clearInterval(interval);
        pollingRef.current.delete(id);
      }
    });

    processingJobs.forEach((job) => {
      if (pollingRef.current.has(job.id)) return;

      if (isTimedOut(job)) {
        if (!timeoutNotifiedRef.current.has(job.id)) {
          timeoutNotifiedRef.current.add(job.id);
          showToast('분석에 실패했습니다. 다시 시도해주세요.', 'error');
        }
        return;
      }

      const interval = setInterval(async () => {
        if (isTimedOut(job)) {
          clearInterval(interval);
          pollingRef.current.delete(job.id);
          if (!timeoutNotifiedRef.current.has(job.id)) {
            timeoutNotifiedRef.current.add(job.id);
            showToast('분석에 실패했습니다. 다시 시도해주세요.', 'error');
          }
          fetchJobs();
          return;
        }

        try {
          const updated = await getJobStatus(job.id);
          if (updated.status === 'completed' || updated.status === 'failed') {
            clearInterval(interval);
            pollingRef.current.delete(job.id);
            if (updated.status === 'failed') {
              showToast('분석에 실패했습니다. 다시 시도해주세요.', 'error');
            }
            fetchJobs();
          }
        } catch { /* ignore */ }
      }, 5000);
      pollingRef.current.set(job.id, interval);
    });

    return () => {
      pollingRef.current.forEach((interval) => clearInterval(interval));
      pollingRef.current.clear();
    };
  }, [jobs, fetchJobs]);

  // Auto-start from URL params
  const autostartDone = useRef(false);
  useEffect(() => {
    const urlParam = searchParams.get('url');
    const autostart = searchParams.get('autostart');
    if (urlParam) {
      setVideoUrl(urlParam);
      if (autostart === 'true' && !autostartDone.current) {
        autostartDone.current = true;
        setTimeout(() => handleUrlSubmit(urlParam), 500);
      }
    }
  }, [searchParams]);

  async function handleFileSubmit(targetFile: File) {
    setError('');
    try {
      setPhase('compressing');
      setProgress(0);
      const compressed = await compressTo480p(targetFile, (p) => { setProgress(Math.round(p.progress * 100)); });
      setPhase('uploading');
      setProgress(0);
      const { id } = await createJob(compressed, (percent) => { setProgress(percent); if (percent === 100) setPhase('starting'); });
      setPhase('idle');
      fetchJobs();
      navigate(`/app/jobs/${id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) setError(t('analyze.error_network'));
      else if (msg.includes('401') || msg.includes('Unauthorized')) setError(t('analyze.error_auth'));
      else setError(msg || t('analyze.error_generic'));
      setPhase('idle');
      setProgress(0);
    }
  }

  async function handleUrlSubmit(url?: string) {
    const targetUrl = (url || videoUrl).trim();
    if (!targetUrl) return;
    setError('');
    try {
      setPhase('downloading');
      setProgress(0);
      const { id } = await createJobFromUrl(targetUrl);
      setPhase('idle');
      setVideoUrl('');
      fetchJobs();
      navigate(`/app/jobs/${id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) setError(t('analyze.error_network'));
      else if (msg.includes('401') || msg.includes('Unauthorized')) setError(t('analyze.error_auth'));
      else setError(msg || t('analyze.error_generic'));
      setPhase('idle');
      setProgress(0);
    }
  }

  const busy = phase !== 'idle';
  const statusText = phase === 'compressing' ? t('analyze.phase_compressing')
    : phase === 'uploading' ? t('analyze.phase_uploading')
    : phase === 'downloading' ? t('analyze.phase_downloading')
    : phase === 'starting' ? t('analyze.phase_starting') : '';

  const filteredJobs = jobs.filter((j) => {
    const status = getEffectiveStatus(j);
    if (jobFilter === 'processing') return status === 'processing' || status === 'pending';
    if (jobFilter === 'completed') return status === 'completed';
    if (jobFilter === 'failed') return status === 'failed';
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto">
      <SEOHead page="analyze" />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{t('analyze.title')}</h1>
        <p className="text-xs text-gray-400 mt-0.5">숏폼 영상을 분석하세요</p>
      </div>

      {/* Inline Input Area */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
        {busy ? (
          <div>
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>{statusText}</span>
              {(phase === 'uploading' || phase === 'compressing') && <span>{progress}%</span>}
              {phase === 'downloading' && <span className="animate-pulse">⏳</span>}
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${phase === 'starting' ? 'bg-emerald-500' : phase === 'compressing' ? 'bg-amber-500' : 'bg-gray-900'}`} style={{ width: (phase === 'starting' || phase === 'downloading') ? '100%' : `${progress}%` }} />
            </div>
          </div>
        ) : (
          <>
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-4 ${
                isDragActive ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-600 font-medium">📎 영상 파일을 드래그하거나 클릭해서 업로드</p>
              <p className="text-xs text-gray-400 mt-1">MP4, MOV, WebM · 최대 200MB</p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">또는</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* URL Input */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                  placeholder="영상 URL 입력"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                />
              </div>
              <button
                onClick={() => handleUrlSubmit()}
                disabled={!videoUrl.trim()}
                className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                분석
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-2 ml-1">Instagram, YouTube, TikTok URL 지원</p>
          </>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4">
        {([
          { key: 'all' as JobFilter, label: '전체' },
          { key: 'processing' as JobFilter, label: '분석중' },
          { key: 'completed' as JobFilter, label: '완료' },
          { key: 'failed' as JobFilter, label: '실패' },
        ]).map((f) => (
          <button
            key={f.key}
            onClick={() => setJobFilter(f.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              jobFilter === f.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Job list */}
      {jobsLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Filter className="w-10 h-10 text-gray-200 mb-4" />
          <p className="text-sm text-gray-500">
            {jobFilter === 'all' ? '아직 분석한 영상이 없습니다' :
             jobFilter === 'processing' ? '분석중인 작업이 없습니다' :
             jobFilter === 'completed' ? '완료된 작업이 없습니다' :
             '실패한 작업이 없습니다'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredJobs.map((job) => {
            const status = getEffectiveStatus(job);
            return (
              <button
                key={job.id}
                onClick={() => {
                  if (status === 'completed') navigate(`/app/results/${job.id}`);
                  else if (status === 'processing' || status === 'pending') navigate(`/app/jobs/${job.id}`);
                }}
                className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-sm cursor-pointer transition-all text-left group"
              >
                {/* Thumbnail */}
                <div className="w-20 h-24 rounded-xl overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                  {job.thumbnail_url ? (
                    <img src={job.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <FileVideo className="w-7 h-7 text-gray-300" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {/* Channel badge */}
                  {job.channel_name && (
                    <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-medium mb-1">
                      @{job.channel_name}
                    </span>
                  )}
                  {/* Title */}
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">
                    {job.title || job.product_name || job.video_name || 'Untitled'}
                  </p>
                  {/* Status + Dates */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {status === 'completed' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">✅ 완료</span>
                    )}
                    {(status === 'processing' || status === 'pending') && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />분석중
                      </span>
                    )}
                    {status === 'failed' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">❌ 실패</span>
                    )}
                    <span className="text-[10px] text-gray-400">분석: {timeAgo(job.created_at)}</span>
                    {job.posted_at && (
                      <span className="text-[10px] text-gray-400">· 게시: {timeAgo(job.posted_at)}</span>
                    )}
                    {!job.channel_name && (
                      <span className="text-[10px] text-gray-300">· 직접 업로드</span>
                    )}
                  </div>
                </div>

                {status === 'completed' && <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
