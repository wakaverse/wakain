import { useState } from 'react';
import { Check, Building2, Code2 } from 'lucide-react';
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
  { text: '영상 분석 월 5회', included: true },
  { text: '비교 분석 월 2회', included: true },
  { text: '라이브러리 20개 저장', included: true },
  { text: '레이더 채널 1개', included: true },
  { text: '제작가이드 월 3회', included: true },
  { text: '대본 생성 월 1회', included: true },
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
      <div className="max-w-6xl mx-auto px-6" ref={ref}>
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
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 transition-all duration-700 delay-200 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {/* Free */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-bold text-gray-900">Free</h3>
            <div className="mt-2">
              <span className="text-2xl font-bold text-gray-900">₩0</span>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">베타 기간 무료</p>

            <ul className="mt-6 space-y-2.5">
              {freePlan.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <Check className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span>
                    {f.text}
                    {f.note && <span className="text-xs text-gray-400 ml-1">({f.note})</span>}
                  </span>
                </li>
              ))}
            </ul>

            <button
              onClick={handleFreeStart}
              className="mt-6 w-full py-2.5 bg-gray-100 text-gray-900 text-sm font-medium rounded-full hover:bg-gray-200 transition-colors"
            >
              무료로 시작하기
            </button>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border-2 border-gray-900 bg-white p-6 relative">
            <span className="absolute -top-3 left-5 px-3 py-0.5 bg-gray-900 text-white text-[10px] font-medium tracking-wide uppercase rounded-full">
              Recommended
            </span>

            <h3 className="text-lg font-bold text-gray-900">Pro</h3>
            <div className="mt-2">
              <span className="text-sm font-medium text-gray-500">베타 특별가 준비 중</span>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">더 많이 분석하고 비교하세요</p>

            <ul className="mt-6 space-y-2.5">
              {proPlan.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <Check className="w-3.5 h-3.5 text-gray-900 mt-0.5 flex-shrink-0" />
                  <span>
                    {f.text}
                    {f.note && <span className="text-xs text-gray-400 ml-1">({f.note})</span>}
                  </span>
                </li>
              ))}
            </ul>

            {proClicked ? (
              <div className="mt-6 w-full py-2.5 bg-green-50 text-green-700 text-sm font-medium rounded-full text-center">
                출시 시 우선 안내드립니다
              </div>
            ) : (
              <button
                onClick={handleProInterest}
                className="mt-6 w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
              >
                출시 알림 받기
              </button>
            )}
          </div>

          {/* Enterprise */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-4 h-4 text-gray-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Enterprise</h3>
            </div>
            <p className="text-xs text-gray-500">팀 단위 분석 + 전용 벤치마크</p>

            <ul className="mt-6 space-y-2.5 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                무제한 분석 / 비교
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                팀 멤버 관리
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                카테고리 벤치마크 리포트
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                커스텀 리포트 템플릿
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                전담 매니저 지원
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                레이더 채널 무제한
              </li>
            </ul>

            <button
              onClick={() => navigate('/contact?type=enterprise')}
              className="mt-6 w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
            >
              도입 문의하기 →
            </button>
          </div>

          {/* API */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Code2 className="w-4 h-4 text-gray-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">API</h3>
            </div>
            <p className="text-xs text-gray-500">분석 엔진을 연동하세요</p>

            <ul className="mt-6 space-y-2.5 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                영상 구조 분석 API
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                비교 분석 API
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                콘텐츠 DNA API
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                커스텀 연동 지원
              </li>
            </ul>

            <p className="mt-4 text-[11px] text-gray-400">
              마케팅 플랫폼 · 광고 관리 · 커머스 솔루션
            </p>

            <button
              onClick={() => navigate('/contact?type=api')}
              className="mt-4 w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
            >
              API 문의하기 →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
