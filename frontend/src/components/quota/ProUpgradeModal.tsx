import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { logProInterest } from '../../lib/api';

interface ProUpgradeModalProps {
  feature: string;
  plan: string;
  onClose: () => void;
}

const PRO_BENEFITS = [
  { label: '분석 월 50회', feature: 'analyze' },
  { label: '비교 분석 월 20회', feature: 'compare' },
  { label: '라이브러리 200개', feature: 'library' },
  { label: '레이더 채널 5개', feature: 'radar' },
  { label: '제작가이드 월 30회', feature: 'guide' },
  { label: '리포트 내보내기 (워터마크 없음)', feature: 'export' },
];

const FEATURE_LABELS: Record<string, string> = {
  analyze: '무료 분석',
  compare: '비교 분석',
  library: '라이브러리 저장',
  radar: '레이더 채널 등록',
  guide: '제작가이드',
  script: '대본 생성',
};

export default function ProUpgradeModal({ feature, plan, onClose }: ProUpgradeModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const featureLabel = FEATURE_LABELS[feature] || feature;

  async function handleInterest() {
    setLoading(true);
    try {
      await logProInterest(feature, plan);
      setSubmitted(true);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="text-center py-6">
            <p className="text-lg font-semibold text-gray-900 mb-2">감사합니다!</p>
            <p className="text-sm text-gray-500">베타 기간 의견을 참고하고 있습니다</p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              닫기
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-5">
              <p className="text-2xl mb-2">📊</p>
              <p className="text-base font-semibold text-gray-900">
                이번 달 {featureLabel}을 모두 사용했습니다
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-5">
              <p className="text-sm font-semibold text-gray-900 mb-3">Pro 플랜</p>
              <ul className="space-y-2">
                {PRO_BENEFITS.map((b) => (
                  <li key={b.feature} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    {b.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                다음에
              </button>
              <button
                onClick={handleInterest}
                disabled={loading}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:bg-gray-300 transition-colors"
              >
                {loading ? '...' : '관심 있어요'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
