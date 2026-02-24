import { useState, useCallback } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { Upload, FileVideo, X, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { createJob } from '../lib/api';
import { compressTo480p } from '../lib/videoCompress';

const MAX_SIZE = 200 * 1024 * 1024;
const ACCEPTED_TYPES = { 'video/mp4': ['.mp4'], 'video/quicktime': ['.mov'], 'video/webm': ['.webm'] };

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

type Phase = 'idle' | 'compressing' | 'uploading' | 'starting';

export default function AnalyzePage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [compressInfo, setCompressInfo] = useState<string | null>(null);

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    setError('');
    if (rejected.length > 0) {
      const err = rejected[0].errors[0];
      setError(err.message.includes('size')
        ? '파일 크기는 200MB 이하만 업로드 가능합니다.'
        : '.mp4, .mov, .webm 형식만 업로드 가능합니다.');
      return;
    }
    if (accepted.length > 0) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: ACCEPTED_TYPES, maxSize: MAX_SIZE, multiple: false,
  });

  async function handleSubmit() {
    if (!file) return;
    setError('');
    setCompressInfo(null);

    try {
      // Step 1: Compress to 480p (browser-side)
      setPhase('compressing');
      setProgress(0);

      const compressed = await compressTo480p(file, (p) => {
        setProgress(Math.round(p.progress * 100));
      });

      if (compressed !== file) {
        setCompressInfo(
          `${formatBytes(file.size)} → ${formatBytes(compressed.size)} (${Math.round((1 - compressed.size / file.size) * 100)}% 절감)`
        );
      }

      // Step 2: Upload compressed file
      setPhase('uploading');
      setProgress(0);

      const { id } = await createJob(compressed, (percent) => {
        setProgress(percent);
        if (percent === 100) setPhase('starting');
      }, productName || undefined, productCategory || undefined);
      navigate(`/jobs/${id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setError('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
      } else if (msg.includes('401') || msg.includes('Unauthorized')) {
        setError('로그인이 필요합니다.');
      } else {
        setError(msg || '업로드 중 오류가 발생했습니다.');
      }
      setPhase('idle');
      setProgress(0);
    }
  }

  const busy = phase !== 'idle';
  const statusText = phase === 'compressing'
    ? '영상 최적화 중...'
    : phase === 'uploading'
    ? '업로드 중...'
    : phase === 'starting'
    ? '분석 요청 중...'
    : '';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">영상 분석 시작</h1>
        <p className="text-gray-500 text-sm">숏폼 영상을 업로드하면 AI가 자동으로 분석합니다</p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
          isDragActive ? 'border-gray-400 bg-gray-50'
          : file ? 'border-emerald-300 bg-emerald-50/50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        {file ? (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <div>
              <p className="text-gray-900 font-medium">{file.name}</p>
              <p className="text-sm text-gray-500 mt-1">{formatBytes(file.size)}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {isDragActive ? (
              <>
                <Upload className="w-12 h-12 text-gray-500" />
                <p className="text-gray-700 font-medium">여기에 놓으세요</p>
              </>
            ) : (
              <>
                <FileVideo className="w-12 h-12 text-gray-300" />
                <div>
                  <p className="text-gray-700 font-medium">영상을 드래그하거나 클릭하여 선택</p>
                  <p className="text-sm text-gray-400 mt-1">.mp4, .mov, .webm · 최대 200MB</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Product info */}
      {file && !busy && (
        <div className="mt-6 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제품명 <span className="text-gray-400 font-normal">(선택)</span></label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="예: 건강 착즙주스, 무선 청소기"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">카테고리 <span className="text-gray-400 font-normal">(선택)</span></label>
            <input
              type="text"
              value={productCategory}
              onChange={(e) => setProductCategory(e.target.value)}
              placeholder="예: 건강기능식품, 가전제품, 화장품"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400 transition-colors"
            />
          </div>
          <p className="text-xs text-gray-400">제품 정보를 입력하면 더 정확한 마케팅 관점 분석이 가능합니다. 미입력 시 AI가 자동 감지합니다.</p>
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
      {file && !busy && (
        <div className="mt-4 flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <FileVideo className="w-5 h-5 text-gray-600" />
            <div>
              <p className="text-sm text-gray-900 font-medium">{file.name}</p>
              <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setFile(null); setError(''); }}
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
          영상 최적화 완료: {compressInfo}
        </div>
      )}

      {/* Progress */}
      {busy && (
        <div className="mt-6">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>{statusText}</span>
            {(phase === 'uploading' || phase === 'compressing') && <span>{progress}%</span>}
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                phase === 'starting' ? 'bg-emerald-500'
                : phase === 'compressing' ? 'bg-amber-500'
                : 'bg-gray-900'
              }`}
              style={{ width: phase === 'starting' ? '100%' : `${progress}%` }}
            />
          </div>
          {phase === 'compressing' && (
            <p className="text-xs text-gray-400 mt-1">브라우저에서 480p로 변환 중 — 업로드 속도와 분석 속도가 빨라집니다</p>
          )}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!file || busy}
        className="mt-6 w-full py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-full text-sm transition-colors"
      >
        {busy ? statusText : '분석 시작'}
      </button>

      <p className="mt-4 text-center text-xs text-gray-400">
        무료 플랜 기준 월 3건 · 분석 소요 시간 약 3~4분
      </p>
    </div>
  );
}
