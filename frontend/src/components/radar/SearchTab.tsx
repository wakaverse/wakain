import { useState, useCallback, useEffect } from 'react';
import type { RadarReel } from '../../types';
import { searchRadarReels, getRecentSearches } from '../../lib/api';
import VideoCard from './VideoCard';
import { showToast } from '../../hooks/useToast';

const SORT_OPTIONS = [
  { value: 'views', label: '조회순' },
  { value: 'engagement', label: '참여율순' },
  { value: 'recent', label: '최신순' },
];

interface SearchTabProps {
  analyzingJobs: Map<string, { jobId: string; status: string }>;
  favoritedReels: Set<string>;
  selectedReels: Set<string>;
  onAnalyze: (reel: RadarReel) => void;
  onToggleFavorite: (reel: RadarReel) => void;
  onSelectReel: (reelId: string) => void;
}

export default function SearchTab({
  analyzingJobs,
  favoritedReels,
  selectedReels,
  onAnalyze,
  onToggleFavorite,
  onSelectReel,
}: SearchTabProps) {
  const [query, setQuery] = useState('');
  const [reels, setReels] = useState<RadarReel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [platform, setPlatform] = useState('all');
  const [period, setPeriod] = useState('30d');
  const [sort, setSort] = useState('views');
  const [page, setPage] = useState(1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    getRecentSearches(10).then(setRecentSearches).catch(() => {});
  }, []);

  const doSearch = useCallback(async (searchQuery: string, searchPage: number = 1) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const data = await searchRadarReels({
        query: searchQuery.trim(),
        platform: platform === 'all' ? undefined : platform,
        period,
        sort,
        page: searchPage,
        limit: 20,
      });
      setReels(data.reels);
      setTotal(data.total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '검색에 실패했습니다';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [platform, period, sort]);

  const handleSearch = () => {
    setPage(1);
    doSearch(query, 1);
    setShowRecent(false);
  };

  const handleRecentClick = (q: string) => {
    setQuery(q);
    setPage(1);
    doSearch(q, 1);
    setShowRecent(false);
  };

  useEffect(() => {
    if (hasSearched && query.trim()) {
      doSearch(query, page);
    }
  }, [page, platform, period, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowRecent(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="키워드를 입력하세요 (예: 딸기 디저트, 언박싱 리뷰)"
              className="w-full text-sm border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-gray-300 pr-8"
            />
            {query && (
              <button onClick={() => { setQuery(''); setShowRecent(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4L4 12" /></svg>
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="text-sm font-medium px-5 py-2.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {loading ? '...' : '검색'}
          </button>
        </div>

        {/* Recent searches dropdown */}
        {showRecent && recentSearches.length > 0 && !hasSearched && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-2">
            <p className="text-[10px] text-gray-400 px-3 mb-1">최근 검색</p>
            {recentSearches.map((q, i) => (
              <button key={i} onClick={() => handleRecentClick(q)} className="block w-full text-left text-xs px-3 py-1.5 hover:bg-gray-50 text-gray-700">
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      {hasSearched && (
        <div className="flex items-center gap-3 flex-wrap mb-4">
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
              <option value="7d">7일</option>
              <option value="30d">30일</option>
              <option value="90d">90일</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">정렬:</span>
            <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300">
              {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          {total > 0 && (
            <span className="text-xs text-gray-400 ml-auto">
              "{query}" — {total}건
            </span>
          )}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
        </div>
      ) : !hasSearched ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          </div>
          <p className="text-sm text-gray-500">키워드로 소재를 탐색하세요</p>
          <p className="text-xs text-gray-400 mt-1">3개 플랫폼에서 동시에 검색합니다</p>
        </div>
      ) : reels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-gray-500">검색 결과가 없습니다</p>
          <p className="text-xs text-gray-400 mt-1">다른 키워드로 검색해보세요</p>
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
