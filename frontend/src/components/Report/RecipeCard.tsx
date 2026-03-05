import { FileText, Layers, ArrowLeftRight, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import type { ScriptAnalysis, AppealPoint } from '../../types';

const ELEMENT_LABELS: Record<string, string> = {
  authority: '권위',
  hook: '훅',
  sensory_description: '묘사',
  simplicity: '간편',
  process: '과정',
  social_proof: '증거',
  cta: 'CTA',
};

interface Props {
  scriptAnalysis?: ScriptAnalysis;
  appealPoints?: AppealPoint[];
  onNavigate: (path: string) => void;
}

export default function RecipeCard({ scriptAnalysis, appealPoints, onNavigate }: Props) {
  const [copied, setCopied] = useState(false);

  // Build recipe flow from script_analysis.flow_order, or fallback
  let recipeFlow: string[] = [];
  if (scriptAnalysis?.flow_order?.length) {
    recipeFlow = scriptAnalysis.flow_order
      .map(el => ELEMENT_LABELS[el] || el)
      .filter(Boolean);
  } else if (appealPoints?.length) {
    const seen = new Set<string>();
    const typeMap: Record<string, string> = {
      authority: '권위',
      social_proof: '증거',
      feature_demo: '시연',
      track_record: '실적',
      guarantee: '보증',
      price: '가격',
      manufacturing: '제조',
      emotional: '감성',
      myth_bust: '통념깨기',
      ingredient: '성분',
      spec_data: '스펙',
      comparison: '비교',
      design_aesthetic: '디자인',
      lifestyle: '라이프',
      origin: '원산지',
      urgency: '긴급',
      nostalgia: '향수',
      authenticity: '진정성',
    };
    for (const ap of appealPoints) {
      const label = typeMap[ap.type] || ap.type;
      if (!seen.has(label)) { seen.add(label); recipeFlow.push(label); }
    }
  }

  if (!recipeFlow.length) return null;

  const recipeText = recipeFlow.join(' → ');

  const handleCopy = () => {
    navigator.clipboard.writeText(recipeText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-sm font-semibold text-gray-900 mb-3">레시피</p>

      {/* Flow */}
      <div className="bg-[#fafafa] rounded-xl px-4 py-3 mb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {recipeFlow.map((label, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-800">{label}</span>
              {i < recipeFlow.length - 1 && (
                <span className="text-gray-300 text-xs">→</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onNavigate('/app/script')}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-xs font-medium rounded-xl hover:bg-gray-800 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          대본 생성
        </button>
        <button
          onClick={() => onNavigate('/app/expand')}
          className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 text-gray-700 text-xs font-medium rounded-xl hover:border-gray-300 transition-colors"
        >
          <Layers className="w-3.5 h-3.5" />
          소재 확장
        </button>
        <button
          onClick={() => onNavigate('/app/compare')}
          className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 text-gray-700 text-xs font-medium rounded-xl hover:border-gray-300 transition-colors"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          비교에 추가
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 text-gray-700 text-xs font-medium rounded-xl hover:border-gray-300 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
    </div>
  );
}
