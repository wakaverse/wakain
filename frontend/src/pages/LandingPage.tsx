import { Link } from 'react-router-dom';
import { ArrowRight, BarChart2, Target, Eye, Wrench, TrendingUp } from 'lucide-react';

const steps = [
  { num: '01', title: '영상 업로드', desc: '30초면 충분합니다. MP4, MOV, WebM 지원' },
  { num: '02', title: 'AI 자동 분석', desc: '2분 안에 소구 구조와 집중도를 분석합니다' },
  { num: '03', title: '인사이트 리포트', desc: '마케터가 바로 쓸 수 있는 리포트로 전달합니다' },
];

const values = [
  {
    icon: Target,
    title: '소구 레시피',
    desc: '설득 구조를 초 단위로 해체합니다. 어떤 소구가, 언제, 어떻게 작동하는지 파악하세요.',
  },
  {
    icon: Eye,
    title: '집중도 예측',
    desc: '이탈 구간을 사전에 파악합니다. 시청자가 언제 관심을 잃는지 미리 알 수 있습니다.',
  },
  {
    icon: Wrench,
    title: '제작 가이드',
    desc: '분석이 바로 제작 지시서가 됩니다. 분석 결과를 그대로 크리에이터에게 전달하세요.',
  },
  {
    icon: TrendingUp,
    title: '경쟁 비교',
    desc: '내 영상 vs 성공 영상 벤치마크. 무엇이 다르고 무엇을 바꿔야 하는지 보여드립니다.',
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-600 text-xs font-medium mb-6">
              <BarChart2 className="w-3.5 h-3.5" />
              AI 숏폼 영상 분석
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-5 leading-tight tracking-tight">
              숏폼 광고,<br />
              감이 아니라 <span className="text-blue-600">데이터로</span>
            </h1>
            <p className="text-lg text-gray-500 mb-8 leading-relaxed">
              AI가 영상을 해부해서 왜 잘 되는지,<br className="hidden sm:block" />
              어떻게 복제하는지 알려드립니다
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/analyze"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                무료로 분석해보기
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/results/demo-001"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg border border-gray-200 transition-colors"
              >
                샘플 리포트 →
              </Link>
            </div>
          </div>

          {/* Right — Report preview mockup */}
          <div className="hidden lg:block">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              {/* Fake browser bar */}
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-300" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-300" />
                <span className="ml-2 text-xs text-gray-400 font-mono">영상 분석 리포트</span>
              </div>
              {/* Score card */}
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">종합 점수</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-gray-900">82</span>
                      <span className="text-gray-400 text-sm">/100</span>
                      <span className="ml-1 px-2 py-0.5 bg-green-50 text-green-700 text-sm font-bold rounded-md border border-green-100">A등급</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 mb-1">유지율</p>
                    <p className="text-2xl font-bold text-gray-900">95<span className="text-sm font-normal text-gray-400">점</span></p>
                  </div>
                </div>
                {/* Mini attention chart mock */}
                <div className="h-14 bg-gray-50 rounded-lg flex items-end gap-px px-2 pb-2 mb-4 overflow-hidden">
                  {[55,65,72,80,90,88,85,70,60,72,85,90,82,75,65,55,60,72,78,82].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm"
                      style={{
                        height: `${h}%`,
                        backgroundColor: h < 65 ? '#fca5a5' : '#93c5fd',
                        opacity: 0.75,
                      }}
                    />
                  ))}
                </div>
                {/* Strengths & weaknesses */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                    <p className="text-xs text-green-600 font-semibold mb-1.5">강점</p>
                    <p className="text-xs text-green-700 leading-relaxed">훅 즉시 진입 (0초)</p>
                    <p className="text-xs text-green-700 leading-relaxed">소구 7종 다양</p>
                    <p className="text-xs text-green-700 leading-relaxed">시청유지율 95%</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                    <p className="text-xs text-amber-600 font-semibold mb-1.5">개선 필요</p>
                    <p className="text-xs text-amber-700 leading-relaxed">CTA 강도 약함</p>
                    <p className="text-xs text-amber-700 leading-relaxed">후반 집중도 하락</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-10">3단계로 끝납니다</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.num} className="flex gap-4">
                <span className="text-3xl font-black text-blue-100 leading-none flex-shrink-0">{step.num}</span>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value cards */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-xl font-bold text-gray-900 text-center mb-10">리포트로 얻는 것</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {values.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-5 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">{title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">지금 첫 영상을 분석해보세요</h2>
          <p className="text-gray-500 mb-6 text-sm">무료 플랜으로 월 3건 분석 가능합니다</p>
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            무료로 분석해보기
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
