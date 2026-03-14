import { useState, useCallback, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { RadarReel } from '../../types';
import { getTrendingReels, refreshTrending } from '../../lib/api';
import VideoCard from './VideoCard';
import { showToast } from '../../hooks/useToast';

const CATEGORIES = [
  { value: 'all', label: '전체' },
  { value: 'food', label: '식품' },
  { value: 'beauty', label: '뷰티' },
  { value: 'tech', label: '테크' },
  { value: 'lifestyle', label: '라이프스타일' },
  { value: 'education', label: '교육' },
];

const PERIODS = [
  { value: '7d', label: '7일' },
  { value: '14d', label: '14일' },
  { value: '30d', label: '30일' },
];

const SORT_OPTIONS = [
  { value: 'views', label: '조회순' },
  { value: 'engagement', label: '참여율순' },
  { value: 'recent', label: '최신순' },
];

interface TrendTabProps {
  analyzingJobs: Map<string, { jobId: string; status: string }>;
  favoritedReels: Set<string>;
  selectedReels: Set<string>;
  onAnalyze: (reel: RadarReel) => void;
  onToggleFavorite: (reel: RadarReel) => void;
  onSelectReel: (reelId: string) => void;
}

export default function TrendTab({
  analyzingJobs,
  favoritedReels,
  selectedReels,
  onAnalyze,
  onToggleFavorite,
  onSelectReel,
}: TrendTabProps) {
  const [reels, setReels] = useState<RadarReel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [period, setPeriod] = useState('7d');
  const [sort, setSort] = useState('views');
  const [page, setPage] = useState(1);

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTrendingReels({
        category: category === 'all' ? undefined : category,
        platform: platform === 'all' ? undefined : platform,
        period,
        sort,
        page,
        limit: 20,
      });
      setReels(data.reels);
      setTotal(data.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [category, platform, period, sort, page]);

  useEffect(() => { fetchTrending(); }, [fetchTrending]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await refreshTrending(category === 'all' ? undefined : category);
      showToast(`트렌드 새로고침 완료 (${result.collected}건 수집)`, 'success');
      await fetchTrending();
    } catch {
      showToast('트렌드 새로고침에 실패했습니다', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap mb-5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">카테고리:</span>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300">
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">플랫폼:</span>
          <select value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1); }} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300">
            <option value="all">전체</option>
            <option value="instagram">Instagram</option>
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">기간:</span>
          <select value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300">
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">정렬:</span>
          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300">
            {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors flex items-center gap-1"
        >
          {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          {refreshing ? '새로고침 중...' : '새로고침'}
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
        </div>
      ) : reels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-gray-500">트렌드 영상이 없습니다</p>
          <p className="text-xs text-gray-400 mt-1">새로고침 버튼을 눌러 인기 영상을 수집해보세요</p>
          <button onClick={handleRefresh} disabled={refreshing} className="mt-4 text-xs font-medium px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors">
            트렌드 수집하기
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {reels.map((reel) => (
              <VideoCard
                key={reel.id}
                reel={reel}
                onAnalyze={() => onAnalyze(reel)}
                onToggleFavorite={() => onToggleFavorite(reel)}
                isFavorited={favoritedReels.has(reel.id)}
                analysisStatus={analyzingJobs.get(reel.id)}
                isSelected={selectedReels.has(reel.id)}
                onSelect={onSelectReel}
                showCompareCheckbox
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30">이전</button>
              <span className="text-xs text-gray-400">{page} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30">다음</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
