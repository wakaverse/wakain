import { useState, useCallback } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { Upload, FileVideo, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createJob } from '../lib/api';

const MAX_SIZE = 100 * 1024 * 1024; // 100MB
const ACCEPTED_TYPES = { 'video/mp4': ['.mp4'], 'video/quicktime': ['.mov'], 'video/webm': ['.webm'] };

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function AnalyzePage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    setError('');
    if (rejected.length > 0) {
      const err = rejected[0].errors[0];
      if (err.message.includes('size')) {
        setError('파일 크기는 100MB 이하만 업로드 가능합니다.');
      } else {
        setError('.mp4, .mov, .webm 형식만 업로드 가능합니다.');
      }
      return;
    }
    if (accepted.length > 0) {
      setFile(accepted[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    multiple: false,
  });

  async function handleSubmit() {
    if (!file) return;
    setUploading(true);
    setProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) { clearInterval(interval); return p; }
        return p + 10;
      });
    }, 200);

    try {
      const { id } = await createJob(file);
      clearInterval(interval);
      setProgress(100);
      await new Promise((r) => setTimeout(r, 300));
      navigate(`/jobs/${id}`);
    } catch {
      clearInterval(interval);
      setError('업로드 중 오류가 발생했습니다. 다시 시도해주세요.');
      setUploading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-2">영상 분석 시작</h1>
        <p className="text-gray-400">숏폼 영상을 업로드하면 AI가 자동으로 분석합니다</p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-blue-400 bg-blue-500/10'
            : 'border-gray-700 hover:border-gray-600 hover:bg-gray-900/50'
        } ${file ? 'border-green-500/50 bg-green-500/5' : ''}`}
      >
        <input {...getInputProps()} />
        {file ? (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
            <div>
              <p className="text-white font-medium">{file.name}</p>
              <p className="text-sm text-gray-400 mt-1">{formatBytes(file.size)}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {isDragActive ? (
              <>
                <Upload className="w-12 h-12 text-blue-400" />
                <p className="text-blue-400 font-medium">여기에 놓으세요</p>
              </>
            ) : (
              <>
                <FileVideo className="w-12 h-12 text-gray-500" />
                <div>
                  <p className="text-white font-medium">영상을 드래그하거나 클릭하여 선택</p>
                  <p className="text-sm text-gray-500 mt-1">
                    .mp4, .mov, .webm · 최대 100MB
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* File info */}
      {file && !uploading && (
        <div className="mt-4 flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <FileVideo className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-sm text-white font-medium">{file.name}</p>
              <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setFile(null); setError(''); }}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Progress bar */}
      {uploading && (
        <div className="mt-6">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>업로드 중...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!file || uploading}
        className="mt-6 w-full py-3.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
      >
        {uploading ? '업로드 중...' : '분석 시작'}
      </button>

      <p className="mt-4 text-center text-xs text-gray-600">
        무료 플랜 기준 월 3건 · 분석 소요 시간 약 2분
      </p>
    </div>
  );
}
