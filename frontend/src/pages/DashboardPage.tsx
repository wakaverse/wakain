import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, XCircle, Clock, Cpu, FileVideo, ArrowRight } from 'lucide-react';
import { listJobs } from '../lib/api';
import SEOHead from '../components/SEOHead';
import type { Job } from '../types';

function formatSize(mb: number) {
  return `${mb.toFixed(1)} MB`;
}

const statusConfig = {
  pending:    { icon: Clock,        color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-100' },
  processing: { icon: Cpu,          color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100'  },
  completed:  { icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-100' },
  failed:     { icon: XCircle,      color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-100'   },
};

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const langPrefix = i18n.language === 'ko' ? '' : `/${i18n.language}`;

  const statusLabels: Record<string, string> = {
    pending: t('status.pending'),
    processing: t('status.processing'),
    completed: t('status.completed'),
    failed: t('status.failed'),
  };

  function formatDate(iso: string) {
    const localeMap: Record<string, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' };
    return new Date(iso).toLocaleString(localeMap[i18n.language] || 'ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  useEffect(() => {
    listJobs()
      .then(setJobs)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <SEOHead page="dashboard" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('dashboard.title')}</h1>
            <p className="text-gray-500 text-sm mt-1">{t('dashboard.description')}</p>
          </div>
          <Link
            to={`${langPrefix}/analyze`}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t('dashboard.new_analysis')}
          </Link>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-24 bg-gray-50 border border-gray-200 rounded-xl">
            <FileVideo className="w-10 h-10 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-sm">{t('dashboard.empty')}</p>
            <Link
              to={`${langPrefix}/analyze`}
              className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {t('dashboard.first_analysis')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => {
              const { icon: Icon, color, bg, border } = statusConfig[job.status];
              const canView = job.status === 'completed';
              const isActive = job.status === 'pending' || job.status === 'processing';

              const content = (
                <div
                  className={`flex items-center gap-4 p-4 bg-white border ${border} rounded-xl ${
                    canView ? 'hover:border-gray-300 hover:shadow-sm cursor-pointer' : ''
                  } transition-all`}
                >
                  <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${color} ${isActive ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 font-medium text-sm truncate">{job.video_name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400">{formatDate(job.created_at)}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{formatSize(job.video_size_mb)}</span>
                      {job.duration_sec && (
                        <>
                          <span className="text-xs text-gray-300">·</span>
                          <span className="text-xs text-gray-400">{job.duration_sec}{t('dashboard.seconds')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${bg} ${color}`}>
                      {statusLabels[job.status]}
                    </span>
                    {canView && <ArrowRight className="w-4 h-4 text-gray-300" />}
                  </div>
                </div>
              );

              if (canView) {
                return <Link key={job.id} to={`${langPrefix}/results/${job.id}`}>{content}</Link>;
              }
              if (isActive) {
                return <Link key={job.id} to={`${langPrefix}/jobs/${job.id}`}>{content}</Link>;
              }
              return <div key={job.id}>{content}</div>;
            })}
          </div>
        )}
      </div>
    </>
  );
}
