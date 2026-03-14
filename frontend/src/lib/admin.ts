/**
 * Admin utilities — hardcoded admin whitelist + Supabase helpers for admin queries.
 */
import { supabase } from './supabase';

// Admin user IDs whitelist (환경변수 또는 하드코딩)
const ADMIN_IDS: string[] = (() => {
  const envIds = import.meta.env.VITE_ADMIN_IDS;
  if (envIds) return envIds.split(',').map((id: string) => id.trim());
  return [];
})();

export function isAdmin(userId: string | undefined): boolean {
  if (!userId) return false;
  return ADMIN_IDS.includes(userId);
}

// ─── Dashboard RPC helpers ───

interface DateRange {
  start: string; // ISO date string
  end: string;
}

function getDateRange(period: string): DateRange {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;

  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case '7d':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
    default:
      start = new Date(2020, 0, 1);
      break;
  }

  return { start: start.toISOString(), end };
}

// ─── Dashboard Metrics ───

export async function fetchDashboardMetrics(period: string) {
  const { start } = getDateRange(period);

  // Parallel queries
  const [signupsRes, jobsRes, dauRes] = await Promise.all([
    // 신규 가입자 — auth.users는 클라이언트에서 직접 접근 불가, RPC 사용
    supabase.rpc('admin_count_signups', { start_date: start }),
    // 분석 완료
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', start),
    // 활성 사용자 (DAU)
    supabase.rpc('admin_count_active_users', { start_date: start }),
  ]);

  // 누적 수
  const [totalSignupsRes, totalJobsRes] = await Promise.all([
    supabase.rpc('admin_count_signups', { start_date: '2020-01-01T00:00:00Z' }),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed'),
  ]);

  return {
    signups: signupsRes.data ?? 0,
    totalSignups: totalSignupsRes.data ?? 0,
    completedJobs: jobsRes.count ?? 0,
    totalCompletedJobs: totalJobsRes.count ?? 0,
    activeUsers: dauRes.data ?? 0,
  };
}

// ─── Dashboard Charts ───

export async function fetchDailySignupsAndJobs(period: string) {
  const { start } = getDateRange(period);

  const [signupsRes, jobsRes] = await Promise.all([
    supabase.rpc('admin_daily_signups', { start_date: start }),
    supabase.rpc('admin_daily_completed_jobs', { start_date: start }),
  ]);

  return {
    dailySignups: signupsRes.data ?? [],
    dailyJobs: jobsRes.data ?? [],
  };
}

export async function fetchDailyActiveUsers(period: string) {
  const { start } = getDateRange(period);
  const res = await supabase.rpc('admin_daily_active_users', { start_date: start });
  return res.data ?? [];
}

// ─── Pipeline ───

export async function fetchPipelineCosts(_period: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [todayRes, weekRes, monthRes, avgRes] = await Promise.all([
    supabase.rpc('admin_pipeline_cost_sum', { start_date: todayStart }),
    supabase.rpc('admin_pipeline_cost_sum', { start_date: weekStart }),
    supabase.rpc('admin_pipeline_cost_sum', { start_date: monthStart }),
    supabase.rpc('admin_pipeline_cost_avg'),
  ]);

  return {
    today: todayRes.data ?? 0,
    week: weekRes.data ?? 0,
    month: monthRes.data ?? 0,
    perJob: avgRes.data ?? 0,
  };
}

export async function fetchPhaseSuccessRates(period: string) {
  const { start } = getDateRange(period);
  const res = await supabase.rpc('admin_phase_success_rates', { start_date: start });
  return res.data ?? [];
}

export async function fetchRecentFailures() {
  const res = await supabase
    .from('pipeline_logs')
    .select('started_at, phase_name, status, error_message, model_used, result_id')
    .in('status', ['fail', 'retry'])
    .order('started_at', { ascending: false })
    .limit(20);
  return res.data ?? [];
}

export async function fetchAvgAnalysisTime(period: string) {
  const { start } = getDateRange(period);
  const res = await supabase.rpc('admin_avg_analysis_time', { start_date: start });
  return res.data ?? [];
}

// ─── Users ───

export async function fetchUsers(params: {
  search?: string;
  plan?: string;
  proInterest?: boolean;
  offset?: number;
  limit?: number;
}) {
  const res = await supabase.rpc('admin_list_users', {
    search_email: params.search || '',
    filter_plan: params.plan || '',
    filter_pro_interest: params.proInterest ?? false,
    page_offset: params.offset ?? 0,
    page_limit: params.limit ?? 50,
  });
  return res.data ?? [];
}

export async function fetchUserDetail(userId: string) {
  const [quotaRes, logsRes, resultsRes] = await Promise.all([
    supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.rpc('admin_user_results', { target_user_id: userId }),
  ]);

  return {
    quota: quotaRes.data,
    logs: logsRes.data ?? [],
    results: resultsRes.data ?? [],
  };
}

export async function updateUserQuota(
  userId: string,
  quotas: Record<string, { limit: number; used: number }>,
) {
  const res = await supabase
    .from('user_quotas')
    .update({
      quotas,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  return res;
}
