import { useState } from 'react';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { logProInterest } from '../../lib/api';
import { useScrollReveal } from '../../hooks/useScrollReveal';

interface PlanFeature {
  text: string;
  included: boolean;
  note?: string;
}

const freePlan: PlanFeature[] = [
  { text: '영상 분석 월 30회', included: true },
  { text: '비교 분석 월 10회', included: true },
  { text: '라이브러리 100개 저장', included: true },
  { text: '레이더 채널 5개', included: true },
  { text: '제작가이드 월 15회', included: true },
  { text: '대본 생성 월 5회', included: true },
  { text: '리포트 내보내기', included: true, note: '워터마크 포함' },
];

const proPlan: PlanFeature[] = [
  { text: '영상 분석 월 50회', included: true },
  { text: '비교 분석 월 20회', included: true },
  { text: '라이브러리 200개 저장', included: true },
  { text: '레이더 채널 5개', included: true },
  { text: '제작가이드 월 30회', included: true },
  { text: '대본 생성 월 10회', included: true },
  { text: '리포트 내보내기', included: true, note: '워터마크 없음 + 템플릿' },
];

export default function PricingSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [proClicked, setProClicked] = useState(false);
  const { ref, visible } = useScrollReveal();

  async function handleProInterest() {
    setProClicked(true);
    try {
      await logProInterest('landing_pricing', 'pro');
    } catch {
      // non-blocking
    }
  }

  function handleFreeStart() {
    navigate(user ? '/app/analyze' : '/login');
  }

  return (
    <section id="pricing" className="py-20 sm:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-6" ref={ref}>
        <div
          className={`text-center mb-14 transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <span className="text-xs font-medium tracking-widest uppercase text-gray-400">
            Pricing
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            요금제
          </h2>
        </div>

        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-700 delay-200 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {/* Free */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8">
            <h3 className="text-xl font-bold text-gray-900">Free</h3>
            <div className="mt-3">
              <span className="text-3xl font-bold text-gray-900">₩0</span>
            </div>
            <p className="mt-2 text-sm text-gray-500">베타 기간 동안 무료로 시작하세요</p>

            <ul className="mt-8 space-y-3">
              {freePlan.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span>
                    {f.text}
                    {f.note && (
                      <span className="text-xs text-gray-400 ml-1">({f.note})</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            <button
              onClick={handleFreeStart}
              className="mt-8 w-full py-3 bg-gray-100 text-gray-900 text-sm font-medium rounded-full hover:bg-gray-200 transition-colors"
            >
              무료로 시작하기
            </button>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border-2 border-gray-900 bg-white p-8 relative">
            <span className="absolute -top-3 left-6 px-3 py-0.5 bg-gray-900 text-white text-[10px] font-medium tracking-wide uppercase rounded-full">
              Recommended
            </span>

            <h3 className="text-xl font-bold text-gray-900">Pro</h3>
            <div className="mt-3">
              <span className="text-sm font-medium text-gray-500">베타 특별가 준비 중</span>
            </div>
            <p className="mt-2 text-sm text-gray-500">더 많이 분석하고, 더 깊이 비교하세요</p>

            <ul className="mt-8 space-y-3">
              {proPlan.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-gray-900 mt-0.5 flex-shrink-0" />
                  <span>
                    {f.text}
                    {f.note && (
                      <span className="text-xs text-gray-400 ml-1">({f.note})</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            {proClicked ? (
              <div className="mt-8 w-full py-3 bg-green-50 text-green-700 text-sm font-medium rounded-full text-center">
                감사합니다! 출시 시 우선 안내해드리겠습니다
              </div>
            ) : (
              <button
                onClick={handleProInterest}
                className="mt-8 w-full py-3 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
              >
                출시 알림 받기
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
