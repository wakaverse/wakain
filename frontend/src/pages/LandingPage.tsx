import { Link } from 'react-router-dom';
import { ArrowRight, Play, Sparkles } from 'lucide-react';

/* ───── Verdict Mockup (분석 예시) ───── */
function VerdictMockup() {
  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden">
      <div className="bg-gray-50/80 border-b border-gray-100 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28CA41]" />
          </div>
          <span className="ml-2 text-[11px] text-gray-400 font-mono">WakaLab 분석 리포트</span>
        </div>
        <span className="text-[10px] text-gray-300">건강 착즙주스 (NFC 원액)</span>
      </div>
      <div className="p-5">
        {/* 판결 */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-lg">✅</div>
          <div>
            <p className="text-[10px] text-gray-400 mb-0.5">🛑 최종 판결</p>
            <span className="inline-block px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-md">
              집행 권장
            </span>
          </div>
        </div>
        <p className="text-[13px] text-gray-600 leading-relaxed mb-4">
          명확한 문제 제기-해결 구조, 핵심 성분/효능 상세 강조, 강력한 가격 혜택 제시로
          타겟 고객의 구매 전환을 이끌 강력한 소재다.
        </p>

        {/* 근거 */}
        <div className="bg-gray-50 rounded-lg p-3 mb-3">
          <p className="text-[10px] font-semibold text-gray-500 mb-1.5">🔍 판단의 근거</p>
          <div className="space-y-1.5 text-[11px] text-gray-500 leading-relaxed">
            <p>
              <span className="font-mono text-gray-900">[0:00]</span> "염증가득 안색" 문제 제시 →{' '}
              <span className="font-mono text-gray-900">[0:02]</span> "환해졌어요" 즉시 해결책으로 공감 유도
            </p>
            <p>
              <span className="font-mono text-gray-900">[0:04]</span> "100% NFC 착즙 첨가물 無" 핵심 강점 노출 →
              성분 신뢰 확보
            </p>
            <p>
              <span className="font-mono text-gray-900">[0:14]</span> "과채섭취 권장량 3배", "한 잔에 단 33칼로리" 구체적 스펙 수치
            </p>
            <p>
              <span className="font-mono text-gray-900">[0:30]</span> "단독 할인특가", "1L 대용량 1만원대" 파격 가격으로 구매 전환 유도
            </p>
          </div>
        </div>

        {/* 액션 플랜 */}
        <div className="bg-gray-900 rounded-lg p-3">
          <p className="text-[10px] font-semibold text-gray-400 mb-1.5">🛠️ 액션 플랜</p>
          <div className="space-y-1.5">
            <p className="text-[11px] text-gray-300">
              <span className="font-mono text-white">[0:16]</span> 다이어트 구간에 허리 라인 강조 이미지 등 결과물 암시 컷 삽입
            </p>
            <p className="text-[11px] text-gray-300">
              <span className="font-mono text-white">[0:00]</span> 훅 직후 안색 Before→After 전환 컷(0.5초)으로 효능 각인
            </p>
            <p className="text-[11px] text-gray-300">
              <span className="font-mono text-white">[0:28]</span> CTA 직전 "한정 수량"/"오늘 마감" 긴급성 그래픽 모션 추가
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───── Feature Card ───── */
function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="group p-6 rounded-2xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-[0_2px_20px_rgba(0,0,0,0.04)] transition-all">
      <span className="text-2xl mb-3 block">{icon}</span>
      <h3 className="font-semibold text-gray-900 mb-1.5 text-[15px]">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
        {/* Tagline */}
        <div className="text-center mb-14">
          <p className="text-sm text-gray-400 font-medium tracking-wide mb-4">
            마케터를 위한 AI 연구소
          </p>
          <h1 className="text-4xl sm:text-[3.25rem] font-bold text-gray-900 leading-[1.15] tracking-tight mb-5">
            마케터가 원하는 도구,<br />
            만들어드립니다.
          </h1>
          <p className="text-lg text-gray-500 max-w-lg mx-auto leading-relaxed">
            감이 아닌 근거. 느낌이 아닌 데이터.<br />
            WakaLab이 연구하고, 여러분이 결정합니다.
          </p>
        </div>

        {/* Project #1 */}
        <div className="relative mt-4">
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            {/* Left — Description */}
            <div className="lg:pt-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-900 text-white text-[11px] font-semibold rounded-full tracking-wide mb-5">
                <Play className="w-3 h-3 fill-current" />
                PROJECT #1
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 leading-[1.2] tracking-tight">
                숏폼 영상,<br />
                감 대신 근거로.
              </h2>
              <p className="text-lg text-gray-500 mb-6 leading-relaxed">
                프레임 단위 시각 분석과 마케터 관점 진단.<br />
                왜 팔리는지, 왜 안 팔리는지, 어떻게 고칠지.
              </p>

              {/* Mini features */}
              <div className="space-y-3 mb-8">
                {[
                  { label: '판결', desc: '집행 권장 / 조건부 / 불가 — 단호하게' },
                  { label: '근거', desc: '타임스탬프 + 실제 화면 기반 분석' },
                  { label: '액션플랜', desc: '편집자에게 바로 전달 가능한 수정안' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-900 flex-shrink-0 mt-0.5">
                      {item.label.charAt(0)}
                    </span>
                    <div>
                      <span className="text-sm font-medium text-gray-900">{item.label}</span>
                      <span className="text-sm text-gray-400 ml-2">{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Link
                  to="/analyze"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-full text-sm transition-colors"
                >
                  영상 분석하기
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/demo"
                  className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors"
                >
                  샘플 리포트 보기 →
                </Link>
              </div>
            </div>

            {/* Right — 분석 예시 */}
            <div className="hidden lg:block">
              <VerdictMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Comparison — 차별점 */}
      <section className="bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-gray-100 p-6">
              <p className="text-sm font-semibold text-gray-400 mb-4">일반적인 영상 분석</p>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li>"초반 3초 후킹을 더 강하게 하세요"</li>
                <li>"자막 가독성을 높이세요"</li>
                <li>"종합 점수 72점입니다"</li>
                <li className="pt-1 italic">→ 이 정도는 나도 알아</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-900 bg-gray-900 p-6">
              <p className="text-sm font-semibold text-white mb-4">WakaLab</p>
              <ul className="space-y-2.5 text-sm text-gray-300">
                <li><span className="font-mono text-white">[0:04]</span> 리뷰어 멘트 구간의 정보 밀도가 낮아 이탈 예상</li>
                <li>해당 구간에 <strong className="text-white">'3일 만에 변화'</strong> 수치 자막 추가</li>
                <li>구매 결정 핵심인 <strong className="text-white">성분 신뢰</strong>가 10초까지 부재</li>
                <li className="pt-1 text-gray-400 italic">→ 소름 돋는다...</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <p className="text-center text-sm text-gray-400 font-medium mb-10">3단계로 끝납니다</p>
          <div className="grid sm:grid-cols-3 gap-6">
            <FeatureCard
              icon="📤"
              title="영상 + 제품 정보"
              desc="영상을 올리고, 무엇을 파는 영상인지 알려주세요."
            />
            <FeatureCard
              icon="🔬"
              title="AI 마케터 분석"
              desc="프레임 단위 시각 분석 + 마케팅 심리 기반 진단. 약 2분."
            />
            <FeatureCard
              icon="📋"
              title="판결 + 액션플랜"
              desc="팔리겠는가? 왜? 어떻게 고칠까? 리포트 완성."
            />
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
          <Sparkles className="w-5 h-5 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">첫 영상을 진단해보세요</h2>
          <p className="text-gray-400 mb-8 text-sm">무료로 시작. 2분 안에 판결을 받아보세요.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/analyze"
              className="inline-flex items-center gap-2 px-8 py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-full text-sm transition-colors"
            >
              영상 분석하기
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/demo"
              className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors"
            >
              샘플 리포트 먼저 보기 →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
