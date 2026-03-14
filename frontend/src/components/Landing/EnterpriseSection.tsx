import { Building2, Code2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useScrollReveal } from '../../hooks/useScrollReveal';

export default function EnterpriseSection() {
  const { ref, visible } = useScrollReveal();
  const navigate = useNavigate();

  return (
    <section className="py-20 sm:py-28 bg-gray-50">
      <div className="max-w-4xl mx-auto px-6" ref={ref}>
        <div
          className={`text-center mb-14 transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            더 큰 규모로 활용하고 싶으신가요?
          </h2>
        </div>

        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-700 delay-200 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {/* Enterprise */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
              <Building2 className="w-5 h-5 text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Enterprise</h3>
            <p className="mt-1 text-sm font-medium text-gray-500">
              팀 단위 분석 + 전용 벤치마크
            </p>
            <p className="mt-4 text-sm text-gray-500 leading-relaxed">
              우리 팀 전체가 와카랩으로 영상 전략을 세울 수 있습니다.
            </p>

            <ul className="mt-6 space-y-2.5 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                무제한 분석 / 비교
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                팀 멤버 관리
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                카테고리 전용 벤치마크 리포트
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                커스텀 리포트 템플릿
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                전담 매니저 지원
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                레이더 채널 무제한
              </li>
            </ul>

            <button
              onClick={() => navigate('/contact?type=enterprise')}
              className="mt-8 w-full py-3 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
            >
              도입 문의하기 →
            </button>
          </div>

          {/* API */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
              <Code2 className="w-5 h-5 text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">API</h3>
            <p className="mt-1 text-sm font-medium text-gray-500">
              와카랩 분석 엔진을 연동하세요
            </p>
            <p className="mt-4 text-sm text-gray-500 leading-relaxed">
              귀사의 서비스에 숏폼 분석 기능을 직접 탑재할 수 있습니다.
            </p>

            <div className="mt-6">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2.5">제공 API</p>
              <ul className="space-y-2.5 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  영상 구조 분석 API
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  비교 분석 API
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  콘텐츠 DNA API
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  커스텀 연동 지원
                </li>
              </ul>
            </div>

            <p className="mt-5 text-xs text-gray-400">
              활용 사례: 마케팅 플랫폼 · 광고 관리 도구 · 커머스 솔루션
            </p>

            <button
              onClick={() => navigate('/contact?type=api')}
              className="mt-6 w-full py-3 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
            >
              API 문의하기 →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
