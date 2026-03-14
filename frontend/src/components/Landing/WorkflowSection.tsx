import { Scan, ArrowLeftRight, MessageSquareText, PenTool } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

const steps = [
  {
    num: '01',
    title: '분석',
    icon: Scan,
    desc: '영상 URL을 넣으면 구조를 컷 단위로 해부합니다. 훅, 소구, 리듬, 설득 흐름을 자동으로 분석합니다.',
  },
  {
    num: '02',
    title: '비교',
    icon: ArrowLeftRight,
    desc: '잘 되는 영상과 내 영상을 나란히 놓고, 구조적으로 뭐가 다른지 보여줍니다.',
  },
  {
    num: '03',
    title: '코칭',
    icon: MessageSquareText,
    desc: '어디를 어떻게 고쳐야 하는지, 데이터 근거와 함께 알려줍니다.',
  },
  {
    num: '04',
    title: '제작',
    icon: PenTool,
    desc: '분석된 구조를 내 제품에 맞는 대본으로 만들어줍니다.',
  },
];

function ScreenshotPlaceholder({ label }: { label: string }) {
  return (
    <div className="mt-4 aspect-[16/10] rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 mx-auto mb-1.5 rounded-lg bg-gray-200 flex items-center justify-center">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
          </svg>
        </div>
        <p className="text-[10px] text-gray-400">{label}</p>
      </div>
    </div>
  );
}

const screenshotLabels = ['분석 리포트', '비교 화면', '코칭 탭', '제작가이드'];

export default function WorkflowSection() {
  const { ref, visible } = useScrollReveal();

  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-5xl mx-auto px-6" ref={ref}>
        <div
          className={`text-center mb-16 transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <span className="text-xs font-medium tracking-widest uppercase text-gray-400">
            Workflow
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            이렇게 작동합니다
          </h2>
        </div>

        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
          <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-gray-200" />

          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className={`relative text-center transition-all duration-600 ${
                  visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: visible ? `${index * 100}ms` : '0ms' }}
              >
                <div className="relative z-10 mx-auto w-24 h-24 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col items-center justify-center mb-5 transition-shadow duration-300 hover:shadow-md">
                  <Icon className="w-6 h-6 text-gray-900 mb-1" strokeWidth={1.5} />
                  <span className="text-[10px] font-mono text-gray-300">{step.num}</span>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed max-w-[220px] mx-auto">
                  {step.desc}
                </p>

                <ScreenshotPlaceholder label={screenshotLabels[index]} />

                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 -right-2 translate-x-1/2 z-20">
                    <svg width="8" height="12" viewBox="0 0 8 12" fill="none" className="text-gray-300">
                      <path d="M1.5 1L6.5 6L1.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
