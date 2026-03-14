import { motion } from 'framer-motion';
import UrlInput from './UrlInput';

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-gradient-to-b from-gray-200/40 to-transparent blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text + URL Input */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease }}
          >
            <span className="inline-block px-3 py-1 text-[11px] font-medium tracking-widest uppercase text-gray-400 border border-gray-200 rounded-full mb-6">
              Commerce Video Intelligence
            </span>

            <h1 className="text-[2.25rem] sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-gray-900 leading-[1.1]">
              경쟁사 숏폼,
              <br />
              <span className="text-gray-900">왜 잘 되는지 알려드립니다</span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-gray-500 leading-relaxed max-w-md">
              영상의 구조를 컷 단위로 해부하고,
              <br className="hidden sm:block" />
              내 영상과 비교해서, 개선 방향까지 코칭해드립니다
            </p>

            <div className="mt-8">
              <UrlInput source="hero" />
            </div>
          </motion.div>

          {/* Right: Screenshot placeholder */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease }}
            className="hidden lg:block"
          >
            <div className="relative" style={{ perspective: '1200px' }}>
              <div
                className="rounded-xl border border-gray-200 bg-gray-100 shadow-2xl shadow-gray-200/50 overflow-hidden"
                style={{ transform: 'rotateY(-6deg) rotateX(2deg)' }}
              >
                {/* Browser frame mockup */}
                <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                  <div className="ml-3 flex-1 h-5 bg-gray-200 rounded-md" />
                </div>
                {/* Placeholder content */}
                <div className="aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-8">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-200 border border-gray-300 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-400 font-medium">스크린샷 준비 중</p>
                    <p className="text-xs text-gray-300 mt-1">통합 타임라인 분석 결과</p>
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <div className="absolute -top-3 -right-3 px-3 py-1.5 bg-white border border-gray-200 rounded-lg shadow-lg text-xs font-medium text-gray-700">
                훅 강도: <span className="text-green-600">강력</span>
              </div>
              <div className="absolute -bottom-3 -left-3 px-3 py-1.5 bg-white border border-gray-200 rounded-lg shadow-lg text-xs font-medium text-gray-700">
                시각 변화량 <span className="text-blue-600">51</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
