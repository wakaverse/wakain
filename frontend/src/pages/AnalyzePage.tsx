import { useState, useCallback } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Upload, FileVideo, X, AlertCircle, CheckCircle2, Zap, Link2 } from 'lucide-react';
import { createJob, createJobFromUrl } from '../lib/api';
import { compressTo480p } from '../lib/videoCompress';
import SEOHead from '../components/SEOHead';

const MAX_SIZE = 200 * 1024 * 1024;
const ACCEPTED_TYPES = { 'video/mp4': ['.mp4'], 'video/quicktime': ['.mov'], 'video/webm': ['.webm'] };

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

type Phase = 'idle' | 'compressing' | 'uploading' | 'starting' | 'downloading';
type InputMode = 'file' | 'url';

export default function AnalyzePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [compressInfo, setCompressInfo] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    setError('');
    if (rejected.length > 0) {
      const err = rejected[0].errors[0];
      setError(err.message.includes('size')
        ? t('analyze.error_size')
        : t('analyze.error_format'));
      return;
    }
    if (accepted.length > 0) {
      setFile(accepted[0]);
      setPreviewUrl(URL.createObjectURL(accepted[0]));
    }
  }, [t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: ACCEPTED_TYPES, maxSize: MAX_SIZE, multiple: false,
  });

  async function handleSubmit() {
    if (inputMode === 'file' && !file) return;
    if (inputMode === 'url' && !videoUrl.trim()) return;
    setError('');
    setCompressInfo(null);

    try {
      if (inputMode === 'url') {
        // URL mode: server downloads the video
        setPhase('downloading');
        setProgress(0);
        const { id } = await createJobFromUrl(
          videoUrl.trim(),
          productName || undefined,
          productCategory || undefined,
        );
        navigate(`/jobs/${id}`);
      } else {
        // File mode: browser compress + upload
        setPhase('compressing');
        setProgress(0);

        const compressed = await compressTo480p(file!, (p) => {
          setProgress(Math.round(p.progress * 100));
        });

        if (compressed !== file) {
          setCompressInfo(
            `${formatBytes(file!.size)} → ${formatBytes(compressed.size)} (${t('analyze.compress_saving', { percent: Math.round((1 - compressed.size / file!.size) * 100) })})`
          );
        }

        setPhase('uploading');
        setProgress(0);

        const { id } = await createJob(compressed, (percent) => {
          setProgress(percent);
          if (percent === 100) setPhase('starting');
        }, productName || undefined, productCategory || undefined);
        navigate(`/jobs/${id}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setError(t('analyze.error_network'));
      } else if (msg.includes('401') || msg.includes('Unauthorized')) {
        setError(t('analyze.error_auth'));
      } else {
        setError(msg || t('analyze.error_generic'));
      }
      setPhase('idle');
      setProgress(0);
    }
  }

  const busy = phase !== 'idle';
  const statusText = phase === 'compressing'
    ? t('analyze.phase_compressing')
    : phase === 'uploading'
    ? t('analyze.phase_uploading')
    : phase === 'downloading'
    ? t('analyze.phase_downloading')
    : phase === 'starting'
    ? t('analyze.phase_starting')
    : '';

  const canSubmit = inputMode === 'file' ? !!file : !!videoUrl.trim();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
      <SEOHead page="analyze" />
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">{t('analyze.title')}</h1>
        <p className="text-gray-500 text-sm">{t('analyze.description')}</p>
      </div>

      {/* Input mode tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => { setInputMode('file'); setError(''); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            inputMode === 'file' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileVideo className="w-4 h-4" />
          {t('analyze.tab_file')}
        </button>
        <button
          onClick={() => { setInputMode('url'); setError(''); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            inputMode === 'url' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Link2 className="w-4 h-4" />
          {t('analyze.tab_url')}
        </button>
      </div>

      {/* URL input */}
      {inputMode === 'url' && !busy && (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
          <Link2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-700 font-medium mb-4">{t('analyze.url_title')}</p>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://example.com/video.mp4"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400 transition-colors"
          />
          <p className="text-xs text-gray-400 mt-3">
            {t('analyze.url_hint')}
          </p>
        </div>
      )}

      {/* Dropzone (file mode only) */}
      {inputMode === 'file' && <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
          isDragActive ? 'border-gray-400 bg-gray-50'
          : file ? 'border-emerald-300 bg-emerald-50/50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        {file && previewUrl ? (
          <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <video
              src={previewUrl}
              controls
              className="w-full max-w-md rounded-xl shadow-sm"
              style={{ maxHeight: '320px' }}
            />
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <p className="text-gray-900 font-medium text-sm">{file.name}</p>
              <span className="text-xs text-gray-400">({formatBytes(file.size)})</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {isDragActive ? (
              <>
                <Upload className="w-12 h-12 text-gray-500" />
                <p className="text-gray-700 font-medium">{t('analyze.drop_here')}</p>
              </>
            ) : (
              <>
                <FileVideo className="w-12 h-12 text-gray-300" />
                <div>
                  <p className="text-gray-700 font-medium">{t('analyze.drop_title')}</p>
                  <p className="text-sm text-gray-400 mt-1">{t('analyze.drop_hint')}</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>}

      {/* Product info */}
      {canSubmit && !busy && (
        <div className="mt-6 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('analyze.product_name')} <span className="text-gray-400 font-normal">{t('analyze.optional')}</span></label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder={t('analyze.product_name_placeholder')}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('analyze.product_category')} <span className="text-gray-400 font-normal">{t('analyze.optional')}</span></label>
            <input
              type="text"
              value={productCategory}
              onChange={(e) => setProductCategory(e.target.value)}
              placeholder={t('analyze.product_category_placeholder')}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400 transition-colors"
            />
          </div>
          <p className="text-xs text-gray-400">{t('analyze.product_hint')}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* File info bar */}
      {inputMode === 'file' && file && !busy && (
        <div className="mt-4 flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <FileVideo className="w-5 h-5 text-gray-600" />
            <div>
              <p className="text-sm text-gray-900 font-medium">{file.name}</p>
              <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setFile(null); setError(''); if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); } }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Compress info */}
      {compressInfo && !busy && (
        <div className="mt-3 flex items-center gap-2 text-emerald-600 text-xs bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          <Zap className="w-3.5 h-3.5" />
          {t('analyze.compress_done')}: {compressInfo}
        </div>
      )}

      {/* Progress */}
      {busy && (
        <div className="mt-6">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>{statusText}</span>
            {(phase === 'uploading' || phase === 'compressing') && <span>{progress}%</span>}
            {phase === 'downloading' && <span className="animate-pulse">⏳</span>}
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                phase === 'starting' ? 'bg-emerald-500'
                : phase === 'compressing' ? 'bg-amber-500'
                : 'bg-gray-900'
              }`}
              style={{ width: (phase === 'starting' || phase === 'downloading') ? '100%' : `${progress}%` }}
            />
          </div>
          {phase === 'compressing' && (
            <p className="text-xs text-gray-400 mt-1">{t('analyze.compress_hint')}</p>
          )}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || busy}
        className="mt-6 w-full py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-full text-sm transition-colors"
      >
        {busy ? statusText : t('analyze.submit')}
      </button>

      <p className="mt-4 text-center text-xs text-gray-400">
        {t('analyze.plan_info')}
      </p>
    </div>
  );
}
