import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { logActivity } from './landingEvents';

const URL_PATTERN =
  /^https?:\/\/(www\.)?(tiktok\.com|instagram\.com|youtu\.?be|youtube\.com)\/.+/i;

interface UrlInputProps {
  source: 'hero' | 'bottom';
}

export default function UrlInput({ source }: UrlInputProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    if (!URL_PATTERN.test(trimmed)) {
      setError('틱톡, 인스타 릴스, 유튜브 숏츠 URL만 지원합니다');
      logActivity('landing_url_invalid', { url: trimmed, error_reason: 'invalid_platform', source });
      return;
    }

    setError('');
    sessionStorage.setItem('pending_analysis_url', trimmed);
    logActivity('landing_url_input', { url: trimmed, source });

    if (user) {
      navigate('/app/analyze', { state: { pendingUrl: trimmed } });
    } else {
      navigate('/login', { state: { from: { pathname: '/app/analyze' }, pendingUrl: trimmed } });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-lg mx-auto">
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-2 py-1.5 shadow-sm hover:shadow-md transition-shadow focus-within:ring-2 focus-within:ring-gray-900/10 focus-within:border-gray-300">
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(''); }}
          placeholder="분석할 영상 URL을 붙여넣어 보세요"
          className="flex-1 px-4 py-2 text-sm bg-transparent outline-none text-gray-900 placeholder:text-gray-400"
        />
        <button
          type="submit"
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors active:scale-[0.98]"
        >
          무료 분석 시작
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-500 text-center">{error}</p>
      )}
      <p className="mt-3 text-xs text-gray-400 text-center">
        틱톡, 인스타 릴스, 유튜브 숏츠 지원 · 회원가입 없이 체험
      </p>
    </form>
  );
}
