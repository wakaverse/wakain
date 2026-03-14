import { useScrollReveal } from '../../hooks/useScrollReveal';
import UrlInput from './UrlInput';

export default function CTASection() {
  const { ref, visible } = useScrollReveal();

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
              지금 바로
              <br />
              경쟁사 영상을 분석해보세요
            </h2>

            <div className="mt-8">
              <UrlInput source="bottom" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
