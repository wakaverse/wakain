import { useState } from 'react';
import type { MarketingVerdict, Prescriptions, Prescription, DiagnosisResult, DiagnosisAxis } from '../../types';

interface Props {
  verdict: MarketingVerdict | null;
  prescriptions: Prescriptions | null;
  diagnosis: DiagnosisResult | null;
  overallScore: number;
  onSeek?: (time: number) => void;
}

// ── Verdict Card ────────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: string }) {
  const config: Record<string, { bg: string; text: string; icon: string }> = {
    '집행 권장': { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: '✅' },
    '조건부 집행': { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: '⚠️' },
    '집행 불가': { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: '🛑' },
  };
  const c = config[verdict] || config['조건부 집행'];

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border ${c.bg} ${c.text}`}>
      {c.icon} {verdict}
    </span>
  );
}

function VerdictCard({ verdict }: { verdict: MarketingVerdict }) {
  const [showEvidence, setShowEvidence] = useState(false);

  return (
    <div className="rounded-2xl border-2 border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-900 text-white px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold">🎯 마케터 판결</h2>
          <VerdictBadge verdict={verdict.verdict} />
        </div>
        {verdict.product_name && (
          <p className="text-xs text-gray-400">
            {verdict.product_name} {verdict.product_category ? `(${verdict.product_category})` : ''}
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="px-5 py-4 bg-white">
        <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
          {verdict.verdict_summary}
        </div>
      </div>

      {/* Action Plan */}
      {verdict.action_plan && (
        <div className="px-5 py-4 bg-blue-50 border-t">
          <h3 className="text-sm font-bold text-blue-900 mb-2">🛠️ 액션 플랜</h3>
          <div className="text-sm text-blue-800 leading-relaxed whitespace-pre-line">
            {verdict.action_plan}
          </div>
        </div>
      )}

      {/* Evidence (collapsible) */}
      {verdict.evidence && (
        <div className="border-t">
          <button
            onClick={() => setShowEvidence(!showEvidence)}
            className="w-full px-5 py-3 text-left text-sm text-gray-500 hover:bg-gray-50 flex items-center justify-between"
          >
            <span>🔍 판단 근거 {showEvidence ? '접기' : '보기'}</span>
            <span className="text-xs">{showEvidence ? '▲' : '▼'}</span>
          </button>
          {showEvidence && (
            <div className="px-5 pb-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {verdict.evidence}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const size = 80;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

// ── Prescription List ───────────────────────────────────────────────────────

const severityConfig: Record<string, { icon: string; bg: string; border: string; text: string }> = {
  danger: { icon: '🔴', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' },
  warning: { icon: '⚠️', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
  info: { icon: '💡', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
};

function PrescriptionCard({ rx, onSeek }: { rx: Prescription; onSeek?: (t: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = severityConfig[rx.severity] || severityConfig.info;

  const handleTimeClick = () => {
    if (!rx.time_range || !onSeek) return;
    const match = rx.time_range.match(/([\d.]+)/);
    if (match) onSeek(parseFloat(match[1]));
  };

  return (
    <div
      className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3.5 cursor-pointer transition-all hover:shadow-sm`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        <span className="text-sm mt-0.5">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${cfg.text}`}>{rx.symptom}</p>
          {expanded && (
            <div className="mt-2 space-y-1.5">
              <p className="text-sm text-gray-700">→ {rx.recommendation}</p>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>💡 {rx.impact}</span>
                {rx.time_range && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleTimeClick(); }}
                    className="text-blue-600 hover:underline"
                  >
                    ⏱ {rx.time_range}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <span className="text-xs text-gray-400 shrink-0">{expanded ? '▲' : '▼'}</span>
      </div>
    </div>
  );
}

// ── 3-Axis Summary ──────────────────────────────────────────────────────────

function AxisMini({ axis }: { axis: DiagnosisAxis }) {
  const color = axis.score >= 80 ? 'text-green-600' : axis.score >= 60 ? 'text-amber-500' : 'text-red-500';
  const bg = axis.score >= 80 ? 'bg-green-50' : axis.score >= 60 ? 'bg-amber-50' : 'bg-red-50';
  const dangerCount = axis.diagnoses.filter(d => d.severity === 'danger').length;
  const warningCount = axis.diagnoses.filter(d => d.severity === 'warning').length;

  return (
    <div className={`rounded-xl ${bg} p-3.5 flex items-center justify-between`}>
      <div>
        <p className="text-sm font-medium text-gray-900">{axis.name}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          {dangerCount > 0 && <span className="text-red-600">🔴 {dangerCount}</span>}
          {warningCount > 0 && <span className="text-amber-600">⚠️ {warningCount}</span>}
          {dangerCount === 0 && warningCount === 0 && <span className="text-green-600">✅ 양호</span>}
        </div>
      </div>
      <span className={`text-2xl font-bold ${color}`}>{axis.score}</span>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function DiagnosisTab({ verdict, prescriptions, diagnosis, overallScore, onSeek }: Props) {
  const [showAxes, setShowAxes] = useState(false);

  const rxList = prescriptions?.prescriptions || [];
  const dangers = rxList.filter(r => r.severity === 'danger');
  const warnings = rxList.filter(r => r.severity === 'warning');
  const infos = rxList.filter(r => r.severity === 'info');
  const axes = diagnosis?.axes || [];

  return (
    <div className="space-y-5">
      {/* 1. Overall Score + Verdict */}
      <div className="flex items-start gap-5">
        {overallScore > 0 && (
          <div className="shrink-0">
            <ScoreRing score={overallScore} />
            <p className="text-[10px] text-gray-400 text-center mt-1">종합 점수</p>
          </div>
        )}
        <div className="flex-1 min-w-0">
          {verdict ? (
            <VerdictCard verdict={verdict} />
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-500">
              마케터 판결 데이터 없음
            </div>
          )}
        </div>
      </div>

      {/* 2. Top 3 Actions */}
      {prescriptions && prescriptions.top_3_actions.length > 0 && (
        <div className="rounded-xl bg-gray-900 text-white p-4">
          <h3 className="text-sm font-bold mb-3">⚡ 즉시 개선 Top 3</h3>
          <div className="space-y-2">
            {prescriptions.top_3_actions.map((action, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm">
                <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-gray-100">{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Prescription List */}
      {rxList.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">📋 상세 처방전</h3>
            <div className="flex items-center gap-2 text-xs">
              {dangers.length > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full">위험 {dangers.length}</span>
              )}
              {warnings.length > 0 && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">경고 {warnings.length}</span>
              )}
              {infos.length > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">참고 {infos.length}</span>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {rxList.map((rx, i) => (
              <PrescriptionCard key={i} rx={rx} onSeek={onSeek} />
            ))}
          </div>
        </div>
      )}

      {rxList.length === 0 && !verdict && (
        <div className="text-center text-sm text-gray-400 py-8">
          진단 데이터가 없습니다
        </div>
      )}

      {/* 4. 3-Axis Summary (collapsible) */}
      {axes.length > 0 && (
        <div>
          <button
            onClick={() => setShowAxes(!showAxes)}
            className="w-full flex items-center justify-between text-sm font-medium text-gray-600 hover:text-gray-900 py-2"
          >
            <span>📊 3축 진단 상세</span>
            <span className="text-xs">{showAxes ? '▲ 접기' : '▼ 펼치기'}</span>
          </button>
          {showAxes && (
            <div className="space-y-2 mt-2">
              {axes.map((axis) => (
                <AxisMini key={axis.id} axis={axis} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
