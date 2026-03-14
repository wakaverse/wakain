import { useState, useEffect } from 'react';
import { DollarSign, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { fetchPipelineCosts, fetchPhaseSuccessRates, fetchRecentFailures, fetchAvgAnalysisTime } from '../../lib/admin';

const PERIODS = [
  { key: 'today', label: '오늘' },
  { key: '7d', label: '7일' },
  { key: '30d', label: '30일' },
];

interface Costs {
  today: number;
  week: number;
  month: number;
  perJob: number;
}

interface PhaseRate {
  phase_name: string;
  total: number;
  success: number;
  fail: number;
  retry: number;
  success_rate: number;
}

interface FailureLog {
  started_at: string;
  phase_name: string;
  status: string;
  error_message: string;
  model_used: string;
  result_id: string;
}

interface AvgTime {
  day: string;
  avg_seconds: number;
}

export default function AdminPipelinePage() {
  const [period, setPeriod] = useState('7d');
  const [costs, setCosts] = useState<Costs | null>(null);
  const [phases, setPhases] = useState<PhaseRate[]>([]);
  const [failures, setFailures] = useState<FailureLog[]>([]);
  const [avgTime, setAvgTime] = useState<AvgTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedError, setExpandedError] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [c, p, f, t] = await Promise.all([
        fetchPipelineCosts(period),
        fetchPhaseSuccessRates(period),
        fetchRecentFailures(),
        fetchAvgAnalysisTime(period),
      ]);
      setCosts(c);
      setPhases(p);
      setFailures(f);
      setAvgTime(
        (t as Array<{ day: string; avg_seconds: number }>).map((r) => ({
          day: (r.day as string).slice(0, 10),
          avg_seconds: Math.round(r.avg_seconds),
        })),
      );
    } catch (err) {
      console.error('Pipeline load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [period]);

  const costCards = [
    { label: '오늘', value: costs?.today ?? 0 },
    { label: '주간', value: costs?.week ?? 0 },
    { label: '월간', value: costs?.month ?? 0 },
    { label: '건당 평균', value: costs?.perJob ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">파이프라인</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  period === p.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={loadData} disabled={loading} className="p-2 text-gray-400 hover:text-gray-600">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cost Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {costCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">{card.label}</span>
              <DollarSign className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900">${card.value.toFixed(2)}</div>
          </div>
        ))}
      </div>

      {/* Phase Success Rates */}
      <div className="bg-white rounded-xl border border-gray-200/60 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Phase별 성공률</h2>
        {phases.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-400">데이터 없음</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, phases.length * 36)}>
            <BarChart data={phases} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="phase_name" tick={{ fontSize: 11 }} width={80} />
              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              <Bar dataKey="success_rate" name="성공률" radius={[0, 4, 4, 0]}>
                {phases.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.success_rate >= 90 ? '#10B981' : entry.success_rate >= 80 ? '#F59E0B' : '#EF4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Avg Analysis Time */}
      <div className="bg-white rounded-xl border border-gray-200/60 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">평균 분석 시간 추이</h2>
        {avgTime.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-400">데이터 없음</div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={avgTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`} />
              <Tooltip formatter={(value: number) => `${Math.floor(value / 60)}분 ${value % 60}초`} />
              <ReferenceLine y={138} stroke="#3B82F6" strokeDasharray="5 5" label={{ value: '현재 평균 2:18', fontSize: 10, fill: '#3B82F6' }} />
              <ReferenceLine y={90} stroke="#10B981" strokeDasharray="5 5" label={{ value: '목표 1:30', fontSize: 10, fill: '#10B981' }} />
              <Line type="monotone" dataKey="avg_seconds" name="평균 시간" stroke="#6366F1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent Failures */}
      <div className="bg-white rounded-xl border border-gray-200/60 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">최근 실패 로그 (20건)</h2>
        {failures.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">실패 로그 없음</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">시간</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Phase</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">상태</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">에러</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">모델</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((f, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-2 text-xs text-gray-600 whitespace-nowrap">
                      {new Date(f.started_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2 px-2 text-xs font-mono">{f.phase_name}</td>
                    <td className="py-2 px-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        f.status === 'fail' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'
                      }`}>
                        {f.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-600 max-w-xs">
                      <button
                        onClick={() => setExpandedError(expandedError === i ? null : i)}
                        className="text-left hover:text-gray-900 cursor-pointer"
                      >
                        {expandedError === i
                          ? f.error_message
                          : (f.error_message || '').slice(0, 60) + ((f.error_message || '').length > 60 ? '...' : '')}
                      </button>
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-500">{f.model_used || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
