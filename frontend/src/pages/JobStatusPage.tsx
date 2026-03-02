import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';
import { getJob } from '../lib/api';
import type { Job } from '../types';

export default function JobStatusPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
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
          setTimeout(() => navigate(`/app/results/${id}`), 800);
          return;
        }
        if (data.status !== 'failed') {
          setTimeout(poll, 3000);
        }
      } catch {
        setTimeout(poll, 5000);
      }
    }

    poll();
  }, [id, navigate]);

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-24 text-center">
      <div className="bg-white border border-gray-200 rounded-2xl p-10 shadow-sm">
        {job.status === 'pending' && (
          <>
            <div className="w-14 h-14 bg-amber-50 border border-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-7 h-7 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('jobStatus.pending_title')}{dots}</h2>
            <p className="text-gray-500 text-sm">{t('jobStatus.pending_desc')}</p>
          </>
        )}

        {job.status === 'processing' && (
          <>
            <div className="relative w-14 h-14 mx-auto mb-6">
              <div className="w-14 h-14 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-blue-200 animate-ping" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('jobStatus.processing_title')}{dots}</h2>
            <p className="text-gray-500 text-sm mb-6">{t('jobStatus.processing_desc')}</p>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full animate-pulse w-3/4" />
            </div>
          </>
        )}

        {job.status === 'completed' && (
          <>
            <div className="w-14 h-14 bg-green-50 border border-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-7 h-7 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('jobStatus.completed_title')}</h2>
            <p className="text-gray-500 text-sm">{t('jobStatus.completed_desc')}</p>
          </>
        )}

        {job.status === 'failed' && (
          <>
            <div className="w-14 h-14 bg-red-50 border border-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('jobStatus.failed_title')}</h2>
            <p className="text-gray-500 text-sm mb-6">
              {job.error_message || t('jobStatus.failed_desc')}
            </p>
            <Link
              to={`${i18n.language === 'ko' ? '' : `/${i18n.language}`}/analyze`}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {t('jobStatus.retry')}
            </Link>
          </>
        )}

        {job.video_name && (
          <div className="mt-6 pt-6 border-t border-gray-100 text-left">
            <p className="text-xs text-gray-400 mb-1">{t('jobStatus.video_label')}</p>
            <p className="text-sm text-gray-700 font-medium">{job.video_name}</p>
          </div>
        )}
      </div>
    </div>
  );
}
