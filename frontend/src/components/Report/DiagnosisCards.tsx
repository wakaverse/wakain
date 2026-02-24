import { useState } from 'react';
import type { DiagnosisResult, DiagnosisAxis } from '../../types';

interface Props {
  diagnosis: DiagnosisResult;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-50';
  if (score >= 60) return 'bg-amber-50';
  return 'bg-red-50';
}

const severityIcon: Record<string, string> = {
  danger: '🔴',
  warning: '⚠️',
  ok: '✅',
};

const severityText: Record<string, string> = {
  danger: 'text-red-600',
  warning: 'text-amber-600',
  ok: 'text-green-600',
};

function AidaCoverage({ coverage }: { coverage: Record<string, boolean> }) {
  const labels: Record<string, string> = { attention: 'A', interest: 'I', desire: 'D', action: 'A' };
  return (
    <div className="flex gap-1.5 items-center text-sm">
      <span className="text-gray-500 text-xs">AIDA:</span>
      {Object.entries(coverage).map(([k, v]) => (
        <span key={k} className={`px-1.5 py-0.5 rounded text-xs font-medium ${v ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-400 line-through'}`}>
          {labels[k] || k.charAt(0).toUpperCase()}{v ? '✓' : '✗'}
        </span>
      ))}
    </div>
  );
}

function FactsGrid({ axis }: { axis: DiagnosisAxis }) {
  const facts = axis.facts;

  if (axis.id === 'appeal_structure') {
    return (
      <div className="space-y-2 text-sm text-gray-700">
        {facts.aida_coverage && <AidaCoverage coverage={facts.aida_coverage as Record<string, boolean>} />}
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">그룹 {facts.group_count as number}개</span>
          <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">씬 {facts.scene_count as number}개</span>
          <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">소구 {facts.total_appeals as number}개</span>
          {(facts.empty_gaps as any[])?.length > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">빈 구간 {(facts.empty_gaps as any[]).length}개</span>
          )}
        </div>
        {facts.source_ratio && (
          <div className="text-xs text-gray-500">
            대본 {Math.round(((facts.source_ratio as any).script || 0) * 100)}% / 비주얼 {Math.round(((facts.source_ratio as any).visual || 0) * 100)}%
          </div>
        )}
      </div>
    );
  }

  if (axis.id === 'appeal_points') {
    const mustCov = facts.must_coverage as Record<string, boolean> | undefined;
    const recCov = facts.recommended_coverage as Record<string, boolean> | undefined;
    const mentions = facts.product_name_mentions as { script: number; caption: number } | undefined;
    return (
      <div className="space-y-2 text-sm text-gray-700">
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{facts.category as string}</span>
          <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">유형 {facts.type_diversity as number}종 사용</span>
        </div>
        {mustCov && (
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-xs text-gray-500">필수:</span>
            {Object.entries(mustCov).map(([k, v]) => (
              <span key={k} className={`px-1.5 py-0.5 rounded text-xs ${v ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
                {k} {v ? '✓' : '✗'}
              </span>
            ))}
          </div>
        )}
        {recCov && (
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-xs text-gray-500">권장:</span>
            {Object.entries(recCov).map(([k, v]) => (
              <span key={k} className={`px-1.5 py-0.5 rounded text-xs ${v ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                {k} {v ? '✓' : '–'}
              </span>
            ))}
          </div>
        )}
        {mentions && (
          <div className="text-xs text-gray-500">
            제품명 언급: 대본 {mentions.script}회 / 자막 {mentions.caption}회
          </div>
        )}
      </div>
    );
  }

  if (axis.id === 'rhythm_profile') {
    return (
      <div className="space-y-2 text-sm text-gray-700">
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">완급 변화 {facts.dynamic_changes as number}회</span>
          {(facts.overload_scenes as any[])?.length > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">과부하 씬 {(facts.overload_scenes as any[]).length}개</span>
          )}
        </div>
        {(facts.tempo_sequence as string[])?.length > 0 && (
          <div className="flex gap-0.5 items-center">
            <span className="text-xs text-gray-500">템포:</span>
            {(facts.tempo_sequence as string[]).map((t, i) => (
              <span key={i} className={`px-1.5 py-0.5 rounded text-xs font-mono ${t === 'high' ? 'bg-red-100 text-red-600' : t === 'low' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                {t[0].toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

function AxisCard({ axis }: { axis: DiagnosisAxis }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-base font-bold text-gray-900">{axis.name}</h3>
        <div className={`text-3xl font-bold ${scoreColor(axis.score)}`}>
          {axis.score}<span className="text-sm font-normal text-gray-400">점</span>
        </div>
      </div>

      {/* Facts */}
      <div className="mb-4">
        <FactsGrid axis={axis} />
      </div>

      {/* Diagnoses */}
      <div className="space-y-2">
        {axis.diagnoses.map((d, i) => (
          <div
            key={i}
            className={`p-3 rounded-lg border ${d.severity === 'danger' ? 'bg-red-50 border-red-200' : d.severity === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'} cursor-pointer`}
            onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
          >
            <div className="flex items-start gap-2">
              <span className="text-sm">{severityIcon[d.severity] || '•'}</span>
              <p className={`text-sm ${severityText[d.severity] || 'text-gray-700'}`}>{d.finding}</p>
            </div>
            {expandedIdx === i && d.recommendation && (
              <p className="text-xs text-gray-600 mt-2 ml-6">→ {d.recommendation}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DiagnosisCards({ diagnosis }: Props) {
  return (
    <div className="space-y-5">
      {/* Overall */}
      <div className={`rounded-2xl p-5 ${scoreBg(diagnosis.overall_score)} border border-gray-100`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">종합 진단</h2>
          <div className={`text-4xl font-bold ${scoreColor(diagnosis.overall_score)}`}>
            {diagnosis.overall_score}<span className="text-base font-normal text-gray-400">점</span>
          </div>
        </div>
        {diagnosis.top_3_actions.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">우선 개선 사항</p>
            <div className="space-y-1.5">
              {diagnosis.top_3_actions.map((action, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-800">
                  <span className="text-xs bg-gray-200 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  {action}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Axis cards */}
      {diagnosis.axes.map((axis) => (
        <AxisCard key={axis.id} axis={axis} />
      ))}
    </div>
  );
}
