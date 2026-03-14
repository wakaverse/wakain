import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, X, ExternalLink, Save } from 'lucide-react';
import { fetchUsers, fetchUserDetail, updateUserQuota } from '../../lib/admin';

interface UserRow {
  user_id: string;
  email: string;
  signup_date: string;
  last_active: string | null;
  analyze_count: number;
  compare_count: number;
  plan: string;
  pro_interest: boolean;
}

interface UserResult {
  result_id: string;
  job_id: string;
  video_name: string;
  thumbnail_url: string | null;
  platform: string | null;
  created_at: string;
}

interface ActivityLog {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const FEATURE_LABELS: Record<string, string> = {
  analyze: '분석',
  compare: '비교',
  library: '라이브러리',
  radar: '레이더',
  guide: '제작가이드',
  script: '대본 생성',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [proFilter, setProFilter] = useState(false);
  const [loading, setLoading] = useState(true);

  // Detail panel
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [quota, setQuota] = useState<Record<string, { limit: number; used: number }> | null>(null);
  const [editedQuota, setEditedQuota] = useState<Record<string, { limit: number; used: number }> | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [results, setResults] = useState<UserResult[]>([]);
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUsers({
        search,
        plan: planFilter,
        proInterest: proFilter,
      });
      setUsers(data);
    } catch (err) {
      console.error('Users load error:', err);
    } finally {
      setLoading(false);
    }
  }, [search, planFilter, proFilter]);

  useEffect(() => {
    const debounce = setTimeout(loadUsers, 300);
    return () => clearTimeout(debounce);
  }, [loadUsers]);

  const openDetail = async (user: UserRow) => {
    setSelectedUser(user);
    setDetailLoading(true);
    try {
      const detail = await fetchUserDetail(user.user_id);
      const q = detail.quota?.quotas ?? null;
      setQuota(q);
      setEditedQuota(q ? JSON.parse(JSON.stringify(q)) : null);
      setLogs(detail.logs);
      setResults(detail.results);
    } catch (err) {
      console.error('User detail error:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveQuota = async () => {
    if (!selectedUser || !editedQuota) return;
    setSaving(true);
    try {
      await updateUserQuota(selectedUser.user_id, editedQuota);
      setQuota(JSON.parse(JSON.stringify(editedQuota)));
    } catch (err) {
      console.error('Quota save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const quotaChanged = quota && editedQuota && JSON.stringify(quota) !== JSON.stringify(editedQuota);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">사용자 관리</h1>
        <button onClick={loadUsers} disabled={loading} className="p-2 text-gray-400 hover:text-gray-600">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="이메일 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
        >
          <option value="">전체 플랜</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={proFilter}
            onChange={(e) => setProFilter(e.target.checked)}
            className="rounded"
          />
          Pro 관심만
        </label>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500">이메일</th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500">가입일</th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500">마지막 접속</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500">분석</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500">비교</th>
                <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500">플랜</th>
                <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500">Pro관심</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-gray-400">사용자 없음</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.user_id}
                    onClick={() => openDetail(u)}
                    className={`border-b border-gray-50 cursor-pointer transition-colors ${
                      selectedUser?.user_id === u.user_id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-gray-900 font-medium truncate max-w-[200px]">{u.email}</td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(u.signup_date).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs whitespace-nowrap">
                      {u.last_active ? new Date(u.last_active).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-700">{u.analyze_count}</td>
                    <td className="py-2.5 px-3 text-right text-gray-700">{u.compare_count}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        u.plan === 'pro' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {u.plan || 'free'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">{u.pro_interest ? '✓' : ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Slide Panel */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/10" onClick={() => setSelectedUser(null)} />
          <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200/60 px-5 py-3 flex items-center justify-between z-10">
              <h2 className="font-semibold text-sm text-gray-900 truncate">{selectedUser.email}</h2>
              <button onClick={() => setSelectedUser(null)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="p-5 space-y-6">
                {/* Basic Info */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">기본 정보</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-500">가입일</div>
                    <div className="text-gray-900">{new Date(selectedUser.signup_date).toLocaleDateString('ko-KR')}</div>
                    <div className="text-gray-500">마지막 접속</div>
                    <div className="text-gray-900">{selectedUser.last_active ? new Date(selectedUser.last_active).toLocaleDateString('ko-KR') : '-'}</div>
                    <div className="text-gray-500">플랜</div>
                    <div className="text-gray-900">{selectedUser.plan || 'free'}</div>
                    <div className="text-gray-500">분석</div>
                    <div className="text-gray-900">{selectedUser.analyze_count}건</div>
                  </div>
                </div>

                {/* Quota Adjustment */}
                {editedQuota && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase">회수 제한 조정</h3>
                      {quotaChanged && (
                        <button
                          onClick={handleSaveQuota}
                          disabled={saving}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                        >
                          <Save className="w-3 h-3" />
                          {saving ? '저장중...' : '저장'}
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {Object.entries(editedQuota).map(([feature, val]) => (
                        <div key={feature} className="flex items-center gap-3 text-sm">
                          <span className="text-gray-500 w-20">{FEATURE_LABELS[feature] || feature}</span>
                          <input
                            type="number"
                            value={val.used}
                            onChange={(e) => {
                              const newQ = { ...editedQuota };
                              newQ[feature] = { ...val, used: parseInt(e.target.value) || 0 };
                              setEditedQuota(newQ);
                            }}
                            className="w-14 text-center border border-gray-200 rounded px-1 py-0.5 text-sm"
                          />
                          <span className="text-gray-400">/</span>
                          <input
                            type="number"
                            value={val.limit}
                            onChange={(e) => {
                              const newQ = { ...editedQuota };
                              newQ[feature] = { ...val, limit: parseInt(e.target.value) || 0 };
                              setEditedQuota(newQ);
                            }}
                            className="w-14 text-center border border-gray-200 rounded px-1 py-0.5 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Analysis Results */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">분석 결과</h3>
                  {results.length === 0 ? (
                    <div className="text-sm text-gray-400 py-3">분석 결과 없음</div>
                  ) : (
                    <div className="space-y-2">
                      {results.map((r) => (
                        <a
                          key={r.result_id}
                          href={`/app/results/${r.result_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          {r.thumbnail_url ? (
                            <img src={r.thumbnail_url} alt="" className="w-12 h-12 rounded object-cover bg-gray-100" />
                          ) : (
                            <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400">N/A</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-900 truncate">{r.video_name || '(제목 없음)'}</div>
                            <div className="text-xs text-gray-400 flex items-center gap-2">
                              {r.platform && <span>{r.platform}</span>}
                              <span>{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Activity Logs */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">최근 활동 (30건)</h3>
                  {logs.length === 0 ? (
                    <div className="text-sm text-gray-400 py-3">활동 기록 없음</div>
                  ) : (
                    <div className="space-y-1">
                      {logs.map((log) => (
                        <div key={log.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-gray-50">
                          <span className="text-gray-400 whitespace-nowrap w-20">
                            {new Date(log.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-gray-700 font-mono">{log.action}</span>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <span className="text-gray-400 truncate">
                              {Object.entries(log.metadata).map(([k, v]) => `${k}=${v}`).join(', ')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
