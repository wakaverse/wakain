import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

const headlines = [
  {
    lines: ['이 영상은 왜 잘 되고,', '내 영상은 왜 안 될까?'],
    badge1: { label: '훅 강도:', value: '강력', color: 'text-green-600' },
    badge2: { label: '시각 변화량', value: '51', color: 'text-blue-600' },
    placeholder: { title: '스크린샷 준비 중', sub: '분석 리포트 결과' },
  },
  {
    lines: ['숏폼, 감이 아니라', '구조입니다'],
    badge1: { label: '시각 변화량', value: '51', color: 'text-blue-600' },
    badge2: { label: '구조 점수:', value: '87', color: 'text-purple-600' },
    placeholder: { title: '스크린샷 준비 중', sub: '통합 타임라인 분석 결과' },
  },
  {
    lines: ['분석하고, 비교하고,', '더 잘 만드세요'],
    badge1: { label: '비교 분석:', value: '완료', color: 'text-orange-600' },
    badge2: { label: '개선 포인트', value: '5', color: 'text-red-600' },
    placeholder: { title: '스크린샷 준비 중', sub: '비교 분석 / 제작가이드' },
  },
];

export default function HeroSection() {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();

  const goTo = useCallback((idx: number) => setCurrent(idx), []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % headlines.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  function handleCTA() {
    navigate(user ? '/app/analyze' : '/login');
  }

  const slide = headlines[current];

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-gradient-to-b from-gray-200/40 to-transparent blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text + CTA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease }}
          >
            <span className="inline-block px-3 py-1 text-[11px] font-medium tracking-widest uppercase text-gray-400 border border-gray-200 rounded-full mb-6">
              Commerce Video Intelligence · <span className="text-blue-500">BETA</span>
            </span>

            {/* Rotating headline */}
            <div className="h-[5.5rem] sm:h-[7rem] lg:h-[8rem] relative overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.h1
                  key={current}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5, ease }}
                  className="text-[2.25rem] sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-gray-900 leading-[1.1] absolute inset-0"
                >
                  {slide.lines[0]}
                  <br />
                  <span className="text-gray-900">{slide.lines[1]}</span>
                </motion.h1>
              </AnimatePresence>
            </div>

            {/* Indicators */}
            <div className="flex gap-2 mt-4 mb-5">
              {headlines.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    i === current ? 'bg-gray-900 w-6' : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`헤드라인 ${i + 1}`}
                />
              ))}
            </div>

            <p className="text-base sm:text-lg text-gray-500 leading-relaxed max-w-md">
              영상의 구조를 컷 단위로 해부하고,
              <br className="hidden sm:block" />
              내 영상과 비교해서, 개선 방향까지 코칭해드립니다
            </p>

            <div className="mt-8">
              <button
                onClick={handleCTA}
                className="px-8 py-3.5 bg-gray-900 hover:bg-gray-800 text-white text-base font-medium rounded-full transition-colors"
              >
                베타 무료 시작하기 →
              </button>
              <p className="mt-3 text-sm text-gray-400">
                현재 베타 서비스 중 · 무료로 모든 기능을 체험해보세요
              </p>
            </div>
          </motion.div>

          {/* Right: Screenshot placeholder — synced with headline */}
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
                {/* Placeholder content — transitions with headline */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.5, ease }}
                    className="aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-8"
                  >
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-200 border border-gray-300 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-400 font-medium">{slide.placeholder.title}</p>
                      <p className="text-xs text-gray-300 mt-1">{slide.placeholder.sub}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Floating badges — synced */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`b1-${current}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className="absolute -top-3 -right-3 px-3 py-1.5 bg-white border border-gray-200 rounded-lg shadow-lg text-xs font-medium text-gray-700"
                >
                  {slide.badge1.label} <span className={slide.badge1.color}>{slide.badge1.value}</span>
                </motion.div>
              </AnimatePresence>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`b2-${current}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className="absolute -bottom-3 -left-3 px-3 py-1.5 bg-white border border-gray-200 rounded-lg shadow-lg text-xs font-medium text-gray-700"
                >
                  {slide.badge2.label} <span className={slide.badge2.color}>{slide.badge2.value}</span>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
