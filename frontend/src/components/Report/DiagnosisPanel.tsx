interface DiagnosisEntry {
  time_range: string;
  severity: string;
  finding: string;
  prescription: string;
  dimension: string;
}

interface PrescriptionEntry {
  severity: string;
  symptom: string;
  recommendation: string;
  impact: string;
  priority: number;
}

interface Props {
  strengths: string[];
  weaknesses: string[];
  diagnoses: DiagnosisEntry[];
  prescriptions: PrescriptionEntry[];
  onSeek: (time: number) => void;
}

const severityConfig: Record<string, { icon: string; bg: string; text: string }> = {
  ok: { icon: 'ℹ️', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800' },
  warning: { icon: '⚠️', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800' },
  danger: { icon: '🔴', bg: 'bg-red-50 border-red-200', text: 'text-red-800' },
  info: { icon: 'ℹ️', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800' },
};

function parseStartTime(tr: string): number | null {
  const match = tr.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

export default function DiagnosisPanel({ strengths, weaknesses, diagnoses, prescriptions, onSeek }: Props) {
  return (
    <div className="space-y-6">
      {/* 강점 */}
      {strengths.length > 0 && (
        <div className="bg-green-50 rounded-xl p-5 border border-green-200">
          <h4 className="text-sm font-bold text-green-800 mb-3">✅ 강점</h4>
          <ul className="space-y-1.5">
            {strengths.map((s, i) => (
              <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                <span className="mt-0.5">•</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 약점 */}
      {weaknesses.length > 0 && (
        <div className="bg-red-50 rounded-xl p-5 border border-red-200">
          <h4 className="text-sm font-bold text-red-800 mb-3">⚠️ 약점</h4>
          <ul className="space-y-1.5">
            {weaknesses.map((w, i) => (
              <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                <span className="mt-0.5">•</span> {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 처방 (Top Priority) */}
      {prescriptions.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-gray-800 mb-3">💊 처방 (우선순위)</h4>
          <div className="space-y-3">
            {prescriptions.sort((a, b) => a.priority - b.priority).map((p, i) => {
              const cfg = severityConfig[p.severity] || severityConfig.info;
              return (
                <div key={i} className={`p-4 rounded-xl border ${cfg.bg}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{cfg.icon}</span>
                    <div>
                      <p className={`text-sm font-medium ${cfg.text}`}>{p.symptom}</p>
                      <p className="text-sm text-gray-700 mt-1">{p.recommendation}</p>
                      {p.impact && <p className="text-xs text-gray-500 mt-1">기대 효과: {p.impact}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 상세 진단 */}
      <div>
        <h4 className="text-sm font-bold text-gray-800 mb-3">🩺 구간별 진단 ({diagnoses.length}건)</h4>
        <div className="space-y-2">
          {diagnoses.map((d, i) => {
            const cfg = severityConfig[d.severity] || severityConfig.ok;
            const startTime = parseStartTime(d.time_range);
            return (
              <div
                key={i}
                className={`p-3 rounded-lg border ${cfg.bg} ${startTime !== null ? 'cursor-pointer hover:opacity-80' : ''}`}
                onClick={() => startTime !== null && onSeek(startTime)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span>{cfg.icon}</span>
                  <span className="text-xs font-mono text-gray-500">{d.time_range}</span>
                  <span className="text-xs text-gray-400">{d.dimension}</span>
                </div>
                <p className={`text-sm ${cfg.text}`}>{d.finding}</p>
                <p className="text-xs text-gray-600 mt-1">→ {d.prescription}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
