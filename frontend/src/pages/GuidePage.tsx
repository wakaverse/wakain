import { Upload, Cpu, BarChart3 } from 'lucide-react';

const steps = [
  {
    icon: Upload,
    title: '1. 영상 업로드',
    desc: '분석할 영상 파일을 업로드하거나 URL을 입력하세요. MP4, MOV, WebM 형식을 지원하며, 최대 200MB까지 가능합니다.',
  },
  {
    icon: Cpu,
    title: '2. AI 분석',
    desc: 'AI가 12단계 파이프라인으로 영상을 분석합니다. 제품 인식, 대본 구조, 비주얼 연출, 어텐션 곡선 등을 자동으로 추출합니다. 약 90초 소요됩니다.',
  },
  {
    icon: BarChart3,
    title: '3. 레시피 리포트',
    desc: '제품·대본·영상 3축으로 구성된 레시피 리포트를 확인하세요. 영상의 구조와 전략을 한눈에 파악할 수 있습니다.',
  },
];

export default function GuidePage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">가이드</h1>
      <p className="text-sm text-gray-500 mb-8">WakaLab V2 사용법을 안내합니다.</p>

      <div className="space-y-4">
        {steps.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-white rounded-xl border border-gray-100 p-5 flex gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-gray-50 rounded-xl border border-gray-100 p-5">
        <p className="text-sm font-semibold text-gray-900 mb-2">WakaLab V2</p>
        <p className="text-sm text-gray-500 leading-relaxed">
          WakaLab V2는 숏폼 영상 광고를 AI로 분석하여 '레시피'를 추출하는 도구입니다.
          제품 정보, 대본 구조, 비주얼 연출 패턴을 자동으로 분석하고,
          성과 높은 영상의 공식을 데이터로 정리해 드립니다.
        </p>
      </div>
    </div>
  );
}
