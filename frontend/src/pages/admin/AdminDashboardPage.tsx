import { useState, useEffect } from 'react';
import { Users, CheckCircle2, Activity, RotateCcw, RefreshCw } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { fetchDashboardMetrics, fetchDailySignupsAndJobs, fetchDailyActiveUsers } from '../../lib/admin';

const PERIODS = [
  { key: 'today', label: '오늘' },
  { key: '7d', label: '7일' },
  { key: '30d', label: '30일' },
  { key: 'all', label: '전체' },
];

interface Metrics {
  signups: number;
  totalSignups: number;
  completedJobs: number;
  totalCompletedJobs: number;
  activeUsers: number;
}

interface DailyData {
  day: string;
  signups?: number;
  jobs?: number;
  dau?: number;
}

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState('7d');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [chartData, setChartData] = useState<DailyData[]>([]);
  const [dauData, setDauData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, charts, dau] = await Promise.all([
        fetchDashboardMetrics(period),
        fetchDailySignupsAndJobs(period),
        fetchDailyActiveUsers(period),
      ]);
      setMetrics(m);

      // Merge daily signups + jobs into one array
      const dayMap = new Map<string, DailyData>();
      for (const row of charts.dailySignups) {
        const d = (row.day as string).slice(0, 10);
        dayMap.set(d, { ...dayMap.get(d), day: d, signups: row.count });
      }
      for (const row of charts.dailyJobs) {
        const d = (row.day as string).slice(0, 10);
        dayMap.set(d, { ...dayMap.get(d), day: d, jobs: row.count });
      }
      const merged = Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day));
      setChartData(merged);

      setDauData(
        (dau as Array<{ day: string; dau: number }>).map((r) => ({
          day: (r.day as string).slice(0, 10),
          dau: r.dau,
        })),
      );
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [period]);

  const cards = [
    {
      label: '신규 가입',
      value: metrics?.signups ?? '-',
      sub: `누적 ${metrics?.totalSignups ?? '-'}명`,
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: '분석 완료',
      value: metrics?.completedJobs ?? '-',
      sub: `누적 ${metrics?.totalCompletedJobs ?? '-'}건`,
      icon: CheckCircle2,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: '활성 사용자',
      value: metrics?.activeUsers ?? '-',
      sub: '',
      icon: Activity,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      label: '재방문율',
      value: '-',
      sub: '데이터 수집 중',
      icon: RotateCcw,
      color: 'text-orange-600 bg-orange-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">대시보드</h1>
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
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500">{card.label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{card.value}</div>
            {card.sub && <div className="text-xs text-gray-400 mt-1">{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* Chart 1: Daily Signups + Jobs */}
      <div className="bg-white rounded-xl border border-gray-200/60 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">일별 가입자 + 분석 건수</h2>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-gray-400">데이터 없음</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(v) => `${v}`} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="signups" name="가입자" stroke="#3B82F6" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="jobs" name="분석 완료" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Chart 2: DAU */}
      <div className="bg-white rounded-xl border border-gray-200/60 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">일별 활성 사용자</h2>
        {dauData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-gray-400">데이터 없음</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dauData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(v) => `${v}`} />
              <Bar dataKey="dau" name="활성 사용자" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
