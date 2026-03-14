import { Scan, ArrowLeftRight, Radar, PenTool, TrendingUp, ArrowUpRight } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

const features = [
  {
    icon: Scan,
    title: '분석',
    desc: '영상의 구조를 13단계로 해부합니다. 훅, 소구, 리듬, 설득 흐름을 컷 단위로 분석하고 데이터 기반 코칭까지 제공합니다.',
  },
  {
    icon: ArrowLeftRight,
    title: '비교',
    desc: '두 영상의 구조와 성과를 나란히 비교하고, 무엇이 다른지, 왜 다른지 알려줍니다.',
  },
  {
    icon: Radar,
    title: '레이더',
    desc: '경쟁사 채널을 등록하면 새 영상을 자동으로 감지하고 분석합니다. 트렌드를 놓치지 마세요.',
  },
  {
    icon: PenTool,
    title: '제작가이드',
    desc: '분석된 레시피를 내 제품에 맞게 변환하고, AI가 대본 초안까지 생성합니다.',
  },
  {
    icon: TrendingUp,
    title: '인사이트',
    desc: '축적된 분석 데이터로 카테고리별 트렌드와 성공 패턴을 도출합니다.',
    comingSoon: true,
  },
];

export default function FeaturesSection() {
  const { ref, visible } = useScrollReveal();

  return (
    <section id="features" className="py-20 sm:py-28 bg-white">
      <div className="max-w-5xl mx-auto px-6" ref={ref}>
        <div
          className={`text-center mb-16 transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <span className="text-xs font-medium tracking-widest uppercase text-gray-400">
            Features
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            주요 기능
          </h2>
          <p className="mt-3 text-base text-gray-500 max-w-lg mx-auto">
            영상 분석부터 대본 제작까지, 하나의 워크플로우로 연결됩니다
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className={`transition-all duration-600 ${
                  visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
                }`}
                style={{ transitionDelay: visible ? `${i * 80}ms` : '0ms' }}
              >
                <div
                  className={`group relative rounded-2xl border p-6 transition-all duration-300 hover:shadow-md ${
                    f.comingSoon
                      ? 'border-dashed border-gray-200 bg-gray-50/50'
                      : 'border-gray-100 bg-[#fafafa] hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                      <Icon
                        className={`w-5 h-5 ${f.comingSoon ? 'text-gray-300' : 'text-gray-900'}`}
                        strokeWidth={1.5}
                      />
                    </div>
                    {f.comingSoon ? (
                      <span className="px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase text-gray-400 bg-gray-100 rounded-full">
                        Coming Soon
                      </span>
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    )}
                  </div>
                  <h3
                    className={`text-base font-semibold tracking-tight mb-2 ${
                      f.comingSoon ? 'text-gray-400' : 'text-gray-900'
                    }`}
                  >
                    {f.title}
                  </h3>
                  <p
                    className={`text-sm leading-relaxed ${
                      f.comingSoon ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    {f.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
