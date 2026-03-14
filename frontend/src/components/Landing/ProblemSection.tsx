import { BarChart3, FileQuestion, Target } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

const problems = [
  {
    icon: BarChart3,
    text: '경쟁사 영상은 조회수가 터지는데,\n우리 영상은 왜 안 될까?',
  },
  {
    icon: FileQuestion,
    text: '클라이언트한테 다음 영상 방향을 제안해야 하는데,\n근거가 감밖에 없다',
  },
  {
    icon: Target,
    text: '잘 되는 영상을 참고하고 싶은데,\n뭘 참고해야 하는지 모르겠다',
  },
];

export default function ProblemSection() {
  const { ref, visible } = useScrollReveal();

  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-5xl mx-auto px-6" ref={ref}>
        <h2
          className={`text-center text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-14 transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          이런 고민, 있지 않으세요?
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {problems.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={i}
                className={`rounded-2xl border border-gray-100 bg-[#fafafa] p-7 transition-all duration-700 ${
                  visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: visible ? `${i * 120}ms` : '0ms' }}
              >
                <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm mb-5">
                  <Icon className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
                </div>
                <p className="text-sm sm:text-base text-gray-700 leading-relaxed font-medium whitespace-pre-line">
                  {p.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
