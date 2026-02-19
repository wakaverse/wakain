import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';
import { getJob } from '../lib/api';
import type { Job } from '../types';

export default function JobStatusPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [dots, setDots] = useState('');

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 500);
    return () => clearInterval(dotInterval);
  }, []);

  useEffect(() => {
    if (!id) return;

    async function poll() {
      try {
        const data = await getJob(id!);
        setJob(data);
        if (data.status === 'completed') {
          setTimeout(() => navigate(`/results/${id}`), 800);
          return;
        }
        if (data.status !== 'failed') {
          setTimeout(poll, 3000);
        }
      } catch {
        // retry
        setTimeout(poll, 5000);
      }
    }

    poll();
  }, [id, navigate]);

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-24 text-center">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10">
        {job.status === 'pending' && (
          <>
            <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">대기 중{dots}</h2>
            <p className="text-gray-400 text-sm">분석 대기열에 등록되었습니다. 잠시만 기다려주세요.</p>
          </>
        )}

        {job.status === 'processing' && (
          <>
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-ping" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">분석 중{dots}</h2>
            <p className="text-gray-400 text-sm mb-6">AI가 영상을 분석하고 있습니다. 약 2분 소요됩니다.</p>
            {/* Progress animation */}
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse w-3/4" />
            </div>
          </>
        )}

        {job.status === 'completed' && (
          <>
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">분석 완료!</h2>
            <p className="text-gray-400 text-sm">리포트 페이지로 이동합니다...</p>
          </>
        )}

        {job.status === 'failed' && (
          <>
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">분석 실패</h2>
            <p className="text-gray-400 text-sm mb-6">
              {job.error_message || '알 수 없는 오류가 발생했습니다.'}
            </p>
            <Link
              to="/analyze"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              다시 시도
            </Link>
          </>
        )}

        {job.video_name && (
          <div className="mt-6 pt-6 border-t border-gray-800 text-left">
            <p className="text-xs text-gray-600 mb-1">영상</p>
            <p className="text-sm text-gray-300 font-medium">{job.video_name}</p>
          </div>
        )}
      </div>
    </div>
  );
}
