import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { logActivity } from './landingEvents';

const slides = [
  { label: '요약 탭', desc: '영상 요약 + 메타 + 핵심 코칭' },
  { label: '통합 타임라인', desc: '컬러바 + 변화량 곡선 + 스크립트' },
  { label: '코칭', desc: '잘된 점 + 개선 포인트 + 추천 구조' },
  { label: '제작가이드', desc: '구조 개선 + 레시피 리팩토링' },
  { label: '대본 생성', desc: '대본 초안 결과' },
];

export default function DemoSection() {
  const [current, setCurrent] = useState(0);
  const { ref, visible } = useScrollReveal();

  function go(dir: -1 | 1) {
    const next = (current + dir + slides.length) % slides.length;
    setCurrent(next);
    logActivity('landing_demo_view', { slide_index: next });
  }

  return (
    <section className="py-20 sm:py-28 bg-gray-50">
      <div className="max-w-5xl mx-auto px-6" ref={ref}>
        <div
          className={`text-center mb-12 transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <span className="text-xs font-medium tracking-widest uppercase text-gray-400">
            Live Demo
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            실제 분석 결과를 확인해보세요
          </h2>
          <p className="mt-3 text-sm text-gray-500">
            32초 딸기 푸딩 숏폼을 와카랩이 분석한 결과입니다
          </p>
        </div>

        {/* Carousel */}
        <div
          className={`relative transition-all duration-700 delay-200 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Tab pills */}
            <div className="flex gap-1 px-4 py-3 bg-gray-50 border-b border-gray-200 overflow-x-auto">
              {slides.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setCurrent(i);
                    logActivity('landing_demo_view', { slide_index: i });
                  }}
                  className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    i === current
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Slide content placeholder */}
            <div className="aspect-[16/9] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gray-200 border border-gray-300 flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 font-medium">
                  {slides[current].label}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {slides[current].desc}
                </p>
                <p className="text-xs text-gray-300 mt-3">스크린샷 준비 중</p>
              </div>
            </div>
          </div>

          {/* Nav arrows */}
          <button
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-gray-200 shadow-sm flex items-center justify-center hover:bg-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-gray-200 shadow-sm flex items-center justify-center hover:bg-white transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>

          {/* Dots */}
          <div className="flex justify-center gap-1.5 mt-4">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === current ? 'bg-gray-900' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
