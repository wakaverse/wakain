import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { user, loading, signInWithGoogle, signInWithKakao } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/analyze';

  useEffect(() => {
    if (!loading && user) {
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, from]);

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <FlaskConical className="w-6 h-6 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">WakaLab</h1>
        <p className="text-sm text-gray-500 mb-8">
          시작하려면 로그인하세요
        </p>

        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-gray-300 hover:shadow-sm transition-all"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Google로 계속하기
        </button>

        <button
          onClick={signInWithKakao}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#FEE500] border border-[#FEE500] rounded-xl text-sm font-medium text-[#191919] hover:bg-[#FDD835] hover:shadow-sm transition-all mt-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M12 3C6.48 3 2 6.36 2 10.44c0 2.62 1.75 4.93 4.38 6.24l-1.12 4.1c-.1.36.32.64.62.42l4.86-3.22c.42.04.84.06 1.26.06 5.52 0 10-3.36 10-7.6C22 6.36 17.52 3 12 3z" fill="#191919"/>
          </svg>
          카카오로 계속하기
        </button>

        <p className="mt-6 text-xs text-gray-400">
          로그인하면 이용약관에 동의하는 것으로 간주됩니다
        </p>
      </div>
    </div>
  );
}
