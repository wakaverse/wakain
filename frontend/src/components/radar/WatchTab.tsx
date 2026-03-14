import { useState, useCallback, useEffect } from 'react';
import type { RadarChannel, RadarReel } from '../../types';
import { getRadarFeed } from '../../lib/api';
import FeedFilters, { type ExtendedFilters, filtersToApi } from './FeedFilters';
import VideoCard from './VideoCard';

interface WatchTabProps {
  channels: RadarChannel[];
  lastRadarVisit: string | null;
  analyzingJobs: Map<string, { jobId: string; status: string }>;
  favoritedReels: Set<string>;
  selectedReels: Set<string>;
  onAnalyze: (reel: RadarReel) => void;
  onToggleFavorite: (reel: RadarReel) => void;
  onSelectReel: (reelId: string) => void;
  onOpenChannelManager: () => void;
}

export default function WatchTab({
  channels,
  lastRadarVisit,
  analyzingJobs,
  favoritedReels,
  selectedReels,
  onAnalyze,
  onToggleFavorite,
  onSelectReel,
  onOpenChannelManager,
}: WatchTabProps) {
  const [reels, setReels] = useState<RadarReel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'feed' | 'grouped'>('feed');
  const [filters, setFilters] = useState<ExtendedFilters>({
    sort: 'spike',
    page: 1,
    limit: 30,
  });

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const apiFilters = filtersToApi(filters);
      const data = await getRadarFeed(apiFilters);
      setReels(data.reels);
      setTotal(data.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const totalPages = Math.ceil(total / (filters.limit || 30));

  const isNewReel = (reel: RadarReel): boolean => {
    if (!lastRadarVisit || !reel.posted_at) return false;
    return new Date(reel.posted_at).getTime() > new Date(lastRadarVisit).getTime();
  };

  // Group by channel for grouped view
  const groupedReels = (() => {
    if (viewMode !== 'grouped') return null;
    const grouped = new Map<string, { channel: RadarChannel; reels: RadarReel[] }>();
    for (const reel of reels) {
      const chId = reel.channel?.id || 'unknown';
      if (!grouped.has(chId)) {
        grouped.set(chId, { channel: reel.channel, reels: [] });
      }
      grouped.get(chId)!.reels.push(reel);
    }
    return grouped;
  })();

  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
        </div>
        <p className="text-sm font-medium text-gray-700 mb-1">아직 등록된 채널이 없습니다</p>
        <p className="text-xs text-gray-400 mb-4">채널을 추가하면 떡상 영상을 자동으로 수집합니다</p>
        <button onClick={onOpenChannelManager} className="text-xs font-medium px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors">
          + 채널 추가하기
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Filter bar + view toggle */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1">
          <FeedFilters filters={filters} setFilters={setFilters} channels={channels} />
        </div>
        <div className="flex items-center gap-1 ml-3 shrink-0">
          <button
            onClick={() => setViewMode('feed')}
            className={`text-[10px] px-2 py-1 rounded ${viewMode === 'feed' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            전체 피드
          </button>
          <button
            onClick={() => setViewMode('grouped')}
            className={`text-[10px] px-2 py-1 rounded ${viewMode === 'grouped' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            채널별
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
        </div>
      ) : reels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-gray-500">수집된 영상이 없습니다</p>
          <p className="text-xs text-gray-400 mt-1">채널을 추가하고 수집을 시작하세요</p>
        </div>
      ) : viewMode === 'grouped' && groupedReels ? (
        // Grouped view
        <div className="space-y-8">
          {Array.from(groupedReels.entries()).map(([chId, { channel, reels: chReels }]) => (
            <div key={chId}>
              <div className="flex items-center gap-2 mb-3">
                {channel?.profile_pic_url ? (
                  <img src={channel.profile_pic_url} alt="" className="w-7 h-7 rounded-full" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-200" />
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-900">{channel?.display_name || channel?.ig_username || '알 수 없음'}</p>
                  <p className="text-[10px] text-gray-400">@{channel?.ig_username || '—'} · {chReels.length}개 영상</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {chReels.map((reel) => (
                  <VideoCard
                    key={reel.id}
                    reel={reel}
                    onAnalyze={() => onAnalyze(reel)}
                    onToggleFavorite={() => onToggleFavorite(reel)}
                    isFavorited={favoritedReels.has(reel.id)}
                    analysisStatus={analyzingJobs.get(reel.id)}
                    isNew={isNewReel(reel)}
                    isSelected={selectedReels.has(reel.id)}
                    onSelect={onSelectReel}
                    showCompareCheckbox
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Feed view
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
                isNew={isNewReel(reel)}
                isSelected={selectedReels.has(reel.id)}
                onSelect={onSelectReel}
                showCompareCheckbox
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })} disabled={(filters.page || 1) <= 1} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30">이전</button>
              <span className="text-xs text-gray-400">{filters.page || 1} / {totalPages}</span>
              <button onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })} disabled={(filters.page || 1) >= totalPages} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30">다음</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
