import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus, X, Loader2, ArrowLeftRight, Lightbulb, ChevronDown, ChevronUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { listJobs, getQuota, compareVideos } from '../lib/api';
import type { Job } from '../types';
import type {
  CompareResponse, StructureRow, MatchedGroup, CoachingItem,
} from '../lib/api';
import { formatTime } from '../lib/recipe-utils';
import { CLAIM_TYPE_INFO } from '../lib/recipe-utils';

/* ── Types ── */

interface VideoSlot {
  jobId: string;
  title: string;
  thumbnailUrl?: string;
  status: 'completed' | 'processing' | 'pending' | 'failed';
}

/* ── Event logging helper ── */

async function logCompareEvent(action: string, metadata: Record<string, unknown>) {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return;
    await supabase.from('user_activity_logs').insert({
      user_id: userId,
      action,
      metadata,
    });
  } catch { /* silent */ }
}

/* ── Main Component ── */

export default function ComparePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Input state
  const [slots, setSlots] = useState<VideoSlot[]>([]);
  const [baseJobId, setBaseJobId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [libraryJobs, setLibraryJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Compare state
  const [comparing, setComparing] = useState(false);
  const [report, setReport] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Quota
  const [quotaInfo, setQuotaInfo] = useState<{ used: number; limit: number } | null>(null);

  // Load quota
  useEffect(() => {
    getQuota().then((q) => {
      const c = q.quotas.compare;
      if (c) setQuotaInfo({ used: c.used, limit: c.limit });
    }).catch(() => {});
  }, []);

  // Parse URL params on mount
  useEffect(() => {
    const idsParam = searchParams.get('ids');
    const baseParam = searchParams.get('base');
    if (idsParam) {
      const ids = idsParam.split(',').filter(Boolean).slice(0, 3);
      loadSlotsFromIds(ids);
    } else if (baseParam) {
      loadSlotsFromIds([baseParam]);
      setBaseJobId(baseParam);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSlotsFromIds = async (ids: string[]) => {
    try {
      const jobs = await listJobs();
      const newSlots: VideoSlot[] = [];
      for (const id of ids) {
        const job = jobs.find((j) => j.id === id);
        if (job) {
          newSlots.push({
            jobId: job.id,
            title: job.title || job.video_name || '영상',
            thumbnailUrl: job.thumbnail_url,
            status: job.status as VideoSlot['status'],
          });
        }
      }
      setSlots(newSlots);
    } catch { /* silent */ }
  };

  // Load library jobs for modal
  const openAddModal = useCallback(async () => {
    setShowAddModal(true);
    setLoadingJobs(true);
    try {
      const jobs = await listJobs();
      setLibraryJobs(jobs.filter((j) => j.status === 'completed'));
    } catch { /* silent */ }
    setLoadingJobs(false);
  }, []);

  const addSlot = (job: Job) => {
    if (slots.length >= 3) return;
    if (slots.some((s) => s.jobId === job.id)) return;
    const newSlot: VideoSlot = {
      jobId: job.id,
      title: job.title || job.video_name || '영상',
      thumbnailUrl: job.thumbnail_url,
      status: job.status as VideoSlot['status'],
    };
    setSlots((prev) => [...prev, newSlot]);
    setShowAddModal(false);
    logCompareEvent('compare_add_video', { source: 'library', result_id: job.id, has_analysis: job.status === 'completed' });
  };

  const removeSlot = (jobId: string) => {
    setSlots((prev) => prev.filter((s) => s.jobId !== jobId));
    if (baseJobId === jobId) setBaseJobId(null);
  };

  const allCompleted = slots.length >= 2 && slots.every((s) => s.status === 'completed');
  const scenario = baseJobId ? 'A' : 'B';

  const handleCompare = async () => {
    if (!allCompleted) return;
    setComparing(true);
    setError(null);

    logCompareEvent('compare_scenario_select', { scenario, base_video_id: baseJobId });

    try {
      const resp = await compareVideos({
        result_ids: slots.map((s) => s.jobId),
        scenario: scenario as 'A' | 'B',
        base_result_id: baseJobId || undefined,
      });
      setReport(resp);
      logCompareEvent('compare_report_generate', { video_count: slots.length, scenario });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '비교 분석에 실패했습니다';
      setError(msg);
    }
    setComparing(false);
  };

  // ── Render ──

  if (report) {
    return (
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => setReport(null)}
          className="mb-4 text-sm text-gray-500 hover:text-gray-900"
        >
          &larr; 비교 입력으로 돌아가기
        </button>
        <CompareReport
          report={report}
          slots={slots}
          onToGuide={() => {
            logCompareEvent('compare_to_guide', { scenario: report.scenario, video_ids: report.result_ids });
            if (report.base_result_id) {
              navigate(`/app/guide/${report.base_result_id}`);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5" />
            비교 분석
          </h1>
          <p className="text-sm text-gray-500 mt-1">영상 2~3개를 비교하여 구조적 차이와 소구점 전략을 분석합니다</p>
        </div>
        {quotaInfo && (
          <span className="text-xs text-gray-400">
            비교 {quotaInfo.used}/{quotaInfo.limit}회
          </span>
        )}
      </div>

      {/* Video slots */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {slots.map((slot) => (
          <div key={slot.jobId} className="relative bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
            <button
              onClick={() => removeSlot(slot.jobId)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs hover:bg-gray-700"
            >
              <X className="w-3 h-3" />
            </button>
            {slot.thumbnailUrl ? (
              <img src={slot.thumbnailUrl} alt="" className="w-full aspect-video object-cover rounded-lg mb-2 bg-gray-100" />
            ) : (
              <div className="w-full aspect-video bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-gray-300 text-2xl">
                📱
              </div>
            )}
            <p className="text-xs font-medium text-gray-900 truncate">{slot.title}</p>
            <p className="text-[10px] mt-1">
              {slot.status === 'completed' && <span className="text-green-600">✅ 분석 완료</span>}
              {slot.status === 'processing' && <span className="text-blue-500">🔄 분석 중...</span>}
              {slot.status === 'pending' && <span className="text-yellow-500">⏳ 대기 중</span>}
              {slot.status === 'failed' && <span className="text-red-500">❌ 분석 실패</span>}
            </p>
          </div>
        ))}

        {slots.length < 3 && (
          <button
            onClick={openAddModal}
            className="border-2 border-dashed border-gray-200 rounded-xl p-3 flex flex-col items-center justify-center gap-2 hover:border-gray-400 hover:bg-gray-50 transition-colors min-h-[140px]"
          >
            <Plus className="w-6 h-6 text-gray-400" />
            <span className="text-sm text-gray-500">영상 추가</span>
          </button>
        )}
      </div>

      {/* Scenario selection */}
      {slots.length >= 2 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">개선하고 싶은 영상이 있나요?</p>
          <div className="space-y-2">
            {slots.map((slot) => (
              <label key={slot.jobId} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="base_video"
                  checked={baseJobId === slot.jobId}
                  onChange={() => setBaseJobId(slot.jobId)}
                  className="w-4 h-4 text-gray-900"
                />
                <span className="text-sm text-gray-700">{slot.title}</span>
              </label>
            ))}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="base_video"
                checked={baseJobId === null}
                onChange={() => setBaseJobId(null)}
                className="w-4 h-4 text-gray-900"
              />
              <span className="text-sm text-gray-500">없음 — 패턴만 보고 싶어요</span>
            </label>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Compare button */}
      <button
        onClick={handleCompare}
        disabled={!allCompleted || comparing}
        className="w-full py-3 rounded-xl font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-900 text-white hover:bg-gray-800"
      >
        {comparing ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            비교 리포트 생성 중...
          </span>
        ) : (
          '비교 리포트 생성'
        )}
      </button>

      {!allCompleted && slots.length >= 2 && (
        <p className="text-xs text-gray-400 text-center mt-2">
          모든 영상의 분석이 완료되어야 비교할 수 있습니다
        </p>
      )}

      {/* Add Video Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[70vh] overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-semibold text-sm">영상 추가</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[55vh]">
              <p className="text-xs font-medium text-gray-500 mb-3">라이브러리에서 선택</p>
              {loadingJobs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : libraryJobs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">분석 완료된 영상이 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {libraryJobs.map((job) => {
                    const alreadyAdded = slots.some((s) => s.jobId === job.id);
                    return (
                      <button
                        key={job.id}
                        onClick={() => !alreadyAdded && addSlot(job)}
                        disabled={alreadyAdded}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                          alreadyAdded ? 'opacity-40 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        {job.thumbnail_url ? (
                          <img src={job.thumbnail_url} alt="" className="w-16 h-10 object-cover rounded-lg bg-gray-100 shrink-0" />
                        ) : (
                          <div className="w-16 h-10 bg-gray-100 rounded-lg shrink-0 flex items-center justify-center text-gray-300">📱</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{job.title || job.video_name}</p>
                          <p className="text-[10px] text-gray-400">{new Date(job.created_at).toLocaleDateString()}</p>
                        </div>
                        {alreadyAdded && <span className="text-[10px] text-gray-400">추가됨</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   Compare Report Component (T4)
   ══════════════════════════════════════ */

interface CompareReportProps {
  report: CompareResponse;
  slots: VideoSlot[];
  onToGuide: () => void;
}

function CompareReport({ report, slots, onToGuide }: CompareReportProps) {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-1">비교 리포트</h2>
        <p className="text-sm text-gray-500">
          {report.scenario === 'A' ? '시나리오 A: 기준 영상 개선' : '시나리오 B: 패턴 추출'}
          {' · '}
          {report.result_ids.length}개 영상
        </p>
      </div>

      {/* Part 1: Structure comparison */}
      <StructureTable structure={report.structure} labels={report.video_labels} slots={slots} />

      {/* Part 2: Claim matching */}
      <ClaimMatchingSection matching={report.claim_matching} />

      {/* Part 3: AI Coaching */}
      <CoachingSection coaching={report.coaching} scenario={report.scenario} />

      {/* Bottom: Guide link */}
      {report.scenario === 'A' && report.base_result_id && (
        <button
          onClick={onToGuide}
          className="w-full py-3 rounded-xl bg-gray-900 text-white font-medium text-sm hover:bg-gray-800 transition-colors"
        >
          이 비교 결과를 바탕으로 제작가이드 만들기 &rarr;
        </button>
      )}
    </div>
  );
}

/* ── Part 1: Structure Table ── */

function StructureTable({ structure, labels, slots }: { structure: StructureRow[]; labels: string[]; slots: VideoSlot[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900">파트 1: 전체 구조 비교</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-4 py-2 text-gray-500 font-medium w-36">항목</th>
              {labels.map((label, i) => (
                <th key={label} className="text-left px-4 py-2 text-gray-700 font-semibold">
                  영상 {label}
                  <span className="block text-[10px] font-normal text-gray-400 truncate max-w-[120px]">
                    {slots[i]?.title}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {structure.map((row) => {
              const numericValues = row.values.filter((v): v is number => typeof v === 'number');
              const maxVal = numericValues.length > 0 ? Math.max(...numericValues) : null;

              return (
                <tr key={row.key} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 text-gray-500 font-medium">{row.label}</td>
                  {row.values.map((val, i) => {
                    const isMax = typeof val === 'number' && val === maxVal && numericValues.length > 1;
                    return (
                      <td key={i} className={`px-4 py-2.5 ${isMax ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}>
                        {formatValue(val, row.key)}
                        {isMax && ' ★'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatValue(val: unknown, key: string): string {
  if (val == null) return '-';
  if (typeof val === 'boolean') return val ? '있음' : '없음';
  if (typeof val === 'number') {
    if (key === 'duration') return `${val}초`;
    if (key === 'cut_avg_duration') return `${val}초`;
    return String(val);
  }
  if (Array.isArray(val)) return val.join(' → ');
  if (typeof val === 'object') {
    // appeal_distribution object
    return Object.entries(val as Record<string, number>)
      .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
      .join(', ');
  }
  return String(val);
}

/* ── Part 2: Claim Matching ── */

function ClaimMatchingSection({ matching }: { matching: CompareResponse['claim_matching'] }) {
  const groups = matching?.matched_groups || [];
  const unique = matching?.unique_claims || [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900">파트 2: 소구점별 표현 전략 비교</h3>
        <p className="text-[10px] text-gray-400 mt-0.5">같은 주제의 소구점을 어떻게 다르게 풀었는지 비교합니다</p>
      </div>
      <div className="divide-y divide-gray-100">
        {groups.map((group, gi) => (
          <ClaimGroupCard key={gi} group={group} index={gi} />
        ))}
        {unique.length > 0 && (
          <div className="p-4">
            <p className="text-xs font-medium text-gray-500 mb-2">고유 소구점 (한 영상에만 있는 것)</p>
            <div className="space-y-1.5">
              {unique.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-gray-400 font-medium shrink-0">영상 {c.video}</span>
                  <span className="text-gray-700">{c.claim}</span>
                  <ClaimTypeBadge type={c.type} />
                </div>
              ))}
            </div>
          </div>
        )}
        {groups.length === 0 && unique.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">소구점 매칭 데이터가 없습니다</p>
        )}
      </div>
    </div>
  );
}

function ClaimGroupCard({ group, index }: { group: MatchedGroup; index: number }) {
  const [open, setOpen] = useState(index < 3);

  const handleToggle = () => {
    setOpen(!open);
    if (!open) {
      logCompareEvent('compare_claim_group_expand', { group_theme: group.theme });
    }
  };

  return (
    <div className="p-4">
      <button onClick={handleToggle} className="w-full flex items-center justify-between text-left">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-3.5 h-3.5 text-yellow-500" />
          <span className="text-sm font-medium text-gray-900">{group.theme}</span>
          <span className="text-[10px] text-gray-400">{group.claims.length}개 영상</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {group.claims.map((claim, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold text-gray-600">영상 {claim.video}</span>
                <ClaimTypeBadge type={claim.type} />
              </div>
              <p className="text-xs text-gray-800 mb-1">{claim.claim}</p>
              {claim.strategy && (
                <p className="text-[10px] text-gray-500">전략: {claim.strategy}</p>
              )}
              {claim.time_range && (
                <p className="text-[10px] text-gray-400 mt-1">
                  {formatTime(claim.time_range[0])}~{formatTime(claim.time_range[1])}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClaimTypeBadge({ type }: { type: string }) {
  const info = CLAIM_TYPE_INFO[type];
  if (!info) return <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-md">{type}</span>;
  return (
    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-md">
      {info.icon} {info.label}
    </span>
  );
}

/* ── Part 3: AI Coaching ── */

function CoachingSection({ coaching, scenario }: { coaching: CompareResponse['coaching']; scenario: string }) {
  const items = coaching?.items || [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900">
          파트 3: AI 코칭
          {scenario === 'A' ? ' — 개선 제안' : ' — 공통 패턴'}
        </h3>
      </div>
      <div className="p-4 space-y-4">
        {coaching?.title && (
          <p className="text-sm font-semibold text-gray-900">{coaching.title}</p>
        )}
        {items.map((item, i) => (
          <CoachingCard key={i} item={item} index={i + 1} />
        ))}
        {coaching?.pattern_summary && scenario === 'B' && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="text-xs font-medium text-blue-800 mb-1">공통 패턴 요약</p>
            <p className="text-xs text-blue-700 whitespace-pre-wrap">{coaching.pattern_summary}</p>
          </div>
        )}
        {items.length === 0 && !coaching?.pattern_summary && (
          <p className="text-sm text-gray-400 text-center py-4">코칭 데이터가 없습니다</p>
        )}
      </div>
    </div>
  );
}

function CoachingCard({ item, index }: { item: CoachingItem; index: number }) {
  return (
    <div className="border border-gray-100 rounded-lg p-4">
      <p className="text-sm font-semibold text-gray-900 mb-2">
        {index}. {item.topic}
      </p>
      <div className="space-y-1.5 text-xs">
        <div>
          <span className="text-gray-500 font-medium">현재: </span>
          <span className="text-gray-700">{item.current}</span>
        </div>
        <div>
          <span className="text-blue-600 font-medium">제안: </span>
          <span className="text-gray-700">{item.suggestion}</span>
        </div>
        <div>
          <span className="text-green-600 font-medium">근거: </span>
          <span className="text-gray-600">{item.evidence}</span>
        </div>
      </div>
    </div>
  );
}
