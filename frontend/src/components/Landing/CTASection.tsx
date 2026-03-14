import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useScrollReveal } from '../../hooks/useScrollReveal';

export default function CTASection() {
  const { ref, visible } = useScrollReveal();
  const navigate = useNavigate();
  const { user } = useAuth();

  function handleCTA() {
    navigate(user ? '/app/analyze' : '/login');
  }

  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-3xl mx-auto px-6" ref={ref}>
        <div
          className={`relative rounded-3xl bg-gray-900 px-8 py-16 sm:px-16 sm:py-20 text-center overflow-hidden transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800/50 to-transparent pointer-events-none" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.03] rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />

          <div className="relative">
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
              지금 바로 시작하세요
            </h2>

            <div className="mt-8">
              <button
                onClick={handleCTA}
                className="px-8 py-3.5 bg-white hover:bg-gray-100 text-gray-900 text-base font-medium rounded-full transition-colors"
              >
                베타 무료 시작하기 →
              </button>
              <p className="mt-4 text-sm text-gray-400">
                현재 베타 서비스 중 · 무료로 모든 기능을 체험해보세요
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
