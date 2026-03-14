import { useEffect, useState } from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

const INITIAL_COUNT = 142;

function AnimatedCounter({ target, visible }: { target: number; visible: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let frame: number;
    const duration = 1500;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, visible]);

  return <span>{count.toLocaleString()}</span>;
}

export default function SocialProofSection() {
  const { ref, visible } = useScrollReveal();

  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-3xl mx-auto px-6 text-center" ref={ref}>
        {/* Counter */}
        <div
          className={`mb-14 transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <p className="text-sm text-gray-400 mb-2">지금까지 분석된 영상</p>
          <p className="text-5xl sm:text-6xl font-bold text-gray-900 tracking-tight">
            <AnimatedCounter target={INITIAL_COUNT} visible={visible} />
            <span className="text-2xl sm:text-3xl text-gray-400 ml-1">건</span>
          </p>
        </div>

        {/* Quote */}
        <div
          className={`transition-all duration-700 delay-300 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <blockquote className="relative">
            <div className="text-4xl text-gray-200 absolute -top-4 -left-2 leading-none">&ldquo;</div>
            <p className="text-base sm:text-lg text-gray-700 leading-relaxed italic pl-6">
              잘되는 영상과 비교해서 뭐가 다른지 바로 보이니까,
              <br className="hidden sm:block" />
              클라이언트 제안할 때 근거가 생깁니다
            </p>
            <footer className="mt-4 text-sm text-gray-400 pl-6">
              &mdash; 이종권 CBO
            </footer>
          </blockquote>
        </div>
      </div>
    </section>
  );
}
