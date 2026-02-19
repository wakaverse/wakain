import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, Clock, Cpu, FileVideo, ArrowRight } from 'lucide-react';
import { listJobs } from '../lib/api';
import type { Job } from '../types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSize(mb: number) {
  return `${mb.toFixed(1)} MB`;
}

const statusConfig = {
  pending: { label: '대기 중', icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  processing: { label: '분석 중', icon: Cpu, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  completed: { label: '완료', icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
  failed: { label: '실패', icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
};

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listJobs()
      .then(setJobs)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">분석 대시보드</h1>
          <p className="text-gray-400 text-sm mt-1">이전 분석 결과를 확인하세요</p>
        </div>
        <Link
          to="/analyze"
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          새 분석 시작
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-24 bg-gray-900 border border-gray-800 rounded-xl">
          <FileVideo className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400">아직 분석한 영상이 없습니다</p>
          <Link
            to="/analyze"
            className="mt-4 inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium"
          >
            첫 번째 영상 분석하기
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const { label, icon: Icon, color, bg } = statusConfig[job.status];
            const canView = job.status === 'completed';
            const isActive = job.status === 'pending' || job.status === 'processing';

            const content = (
              <div
                className={`flex items-center gap-4 p-5 bg-gray-900 border border-gray-800 rounded-xl ${
                  canView ? 'hover:border-gray-700 cursor-pointer' : ''
                } transition-colors`}
              >
                <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${color} ${isActive ? 'animate-pulse' : ''}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{job.video_name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-500">{formatDate(job.created_at)}</span>
                    <span className="text-xs text-gray-600">·</span>
                    <span className="text-xs text-gray-500">{formatSize(job.video_size_mb)}</span>
                    {job.duration_sec && (
                      <>
                        <span className="text-xs text-gray-600">·</span>
                        <span className="text-xs text-gray-500">{job.duration_sec}초</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${bg} ${color}`}>
                    {label}
                  </span>
                  {canView && <ArrowRight className="w-4 h-4 text-gray-600" />}
                </div>
              </div>
            );

            if (canView) {
              return (
                <Link key={job.id} to={`/results/${job.id}`}>
                  {content}
                </Link>
              );
            }
            if (isActive) {
              return (
                <Link key={job.id} to={`/jobs/${job.id}`}>
                  {content}
                </Link>
              );
            }
            return <div key={job.id}>{content}</div>;
          })}
        </div>
      )}
    </div>
  );
}
