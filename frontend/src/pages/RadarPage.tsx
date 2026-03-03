import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getRadarChannels,
  getRadarFeed,
  addRadarChannel,
  deleteRadarChannel,
  collectChannel,
  addLibraryItem,
  createJobFromUrl,
  getJobStatus,
} from '../lib/api';
import type { RadarChannel, RadarReel, RadarFilters, LibraryItem } from '../types';
import { showToast } from '../hooks/useToast';
import { Heart, Loader2 } from 'lucide-react';

// ─── Helpers ───

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return '방금';
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return `${Math.floor(days / 30)}개월 전`;
}


const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes


// ─── Popover wrapper ───

function Popover({
  trigger,
  open,
  onToggle,
  onClose,
  children,
}: {
  trigger: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  return (
    <div className="relative inline-block" ref={ref} style={{ zIndex: open ? 9999 : 'auto' }}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
        className="focus:outline-none"
        style={{ all: 'unset', cursor: 'pointer', display: 'inline-block' }}
      >
        {trigger}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[260px]" style={{ zIndex: 99999 }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Filter badge (pill) ───

function FilterPill({
  label,
  active,
}: {
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors cursor-pointer select-none ${
        active
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="ml-0.5">
        <path d="M3 4l2 2 2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

// ─── Extended filter state ───

interface ExtendedFilters extends RadarFilters {
  posted_value?: number;
  posted_unit?: 'days' | 'weeks' | 'months';
  platforms?: { youtube: boolean; tiktok: boolean; instagram: boolean };
  max_spike?: number;
  max_views?: number;
  min_engagement_pct?: number;
  max_engagement_pct?: number;
  channel_ids?: string[];
}

function filtersToApi(f: ExtendedFilters): RadarFilters {
  const api: RadarFilters = {
    sort: f.sort || 'spike',
    page: f.page || 1,
    limit: f.limit || 30,
  };

  if (f.posted_value && f.posted_value > 0) {
    const unit = f.posted_unit || 'months';
    let days = f.posted_value;
    if (unit === 'weeks') days *= 7;
    if (unit === 'months') days *= 30;
    if (days <= 1) api.period = '24h';
    else if (days <= 7) api.period = '7d';
    else if (days <= 30) api.period = '30d';
    else api.period = '90d';
  }

  if (f.platforms) {
    const active = Object.entries(f.platforms).filter(([, v]) => v).map(([k]) => k);
    if (active.length === 1) api.platform = active[0];
  }

  if (f.channel_ids && f.channel_ids.length === 1) {
    api.channel_id = f.channel_ids[0];
  }
  // Multiple channels: send first one (backend filters by user's channels anyway)
  // TODO: backend support for multiple channel_ids

  if (f.min_spike && f.min_spike > 1) api.min_spike = f.min_spike;
  if (f.min_views && f.min_views > 0) api.min_views = f.min_views;
  if (f.min_engagement_pct && f.min_engagement_pct > 0) api.min_engagement = f.min_engagement_pct;
  if (f.keyword) api.keyword = f.keyword;

  return api;
}

// ─── Filter Bar ───

function FilterBar({
  filters,
  setFilters,
  channels,
}: {
  filters: ExtendedFilters;
  setFilters: (f: ExtendedFilters) => void;
  channels: RadarChannel[];
}) {
  const [openPopover, setOpenPopover] = useState<string | null>(null);

  const toggle = (key: string) => { console.log('TOGGLE', key, openPopover); setOpenPopover(openPopover === key ? null : key); };
  const close = () => setOpenPopover(null);

  const hasActiveChannel = (filters.channel_ids?.length ?? 0) > 0;
  // When no channels selected in filter, show all channels (default behavior)
  const hasActiveDate = (filters.posted_value ?? 0) > 0;
  const hasActivePlatform = filters.platforms
    ? Object.values(filters.platforms).some(Boolean) && !Object.values(filters.platforms).every(Boolean)
    : false;
  const hasActiveSpike = (filters.min_spike ?? 1) > 1;
  const hasActiveViews = (filters.min_views ?? 0) > 0;
  const hasActiveEngagement = (filters.min_engagement_pct ?? 0) > 0;
  const hasActiveKeyword = !!filters.keyword;

  const channelLabel = hasActiveChannel ? `${filters.channel_ids!.length}개 채널` : '전체 채널';
  const spikeLabel = hasActiveSpike ? `> ${filters.min_spike}x outlier` : '> 1x outlier';
  const viewsLabel = hasActiveViews ? `Views ${formatNumber(filters.min_views!)}+` : 'Views';
  const engLabel = hasActiveEngagement ? `Engagement ${filters.min_engagement_pct}%+` : 'Engagement rate';
  const dateLabel = hasActiveDate ? `Last ${filters.posted_value} ${filters.posted_unit || 'months'}` : 'Posted date';

  const platformLabel = (() => {
    if (!filters.platforms) return 'Platform';
    const active = Object.entries(filters.platforms).filter(([, v]) => v).map(([k]) => k);
    if (active.length === 0 || active.length === 3) return 'Platform';
    return active.map((p) => p === 'youtube' ? 'YouTube' : p === 'tiktok' ? 'TikTok' : 'Instagram').join(', ');
  })();

  const sortOptions = [
    { value: 'spike', label: 'Spike순' },
    { value: 'views', label: '조회순' },
    { value: 'engagement', label: '참여율순' },
    { value: 'recent', label: '최신순' },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap pb-2 mb-4">
      {/* 1. Search (channel select) */}
      <Popover
        trigger={<FilterPill label={channelLabel} active={hasActiveChannel} />}
        open={openPopover === 'search'}
        onToggle={() => toggle('search')}
        onClose={close}
      >
        <div className="max-h-60 overflow-y-auto space-y-1">
          {channels.length === 0 && (
            <p className="text-xs text-gray-400 py-2">등록된 채널이 없습니다</p>
          )}
          {channels.map((ch) => {
            const checked = filters.channel_ids?.includes(ch.id) ?? false;
            return (
              <label key={ch.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const ids = filters.channel_ids ? [...filters.channel_ids] : [];
                    if (checked) {
                      setFilters({ ...filters, channel_ids: ids.filter((i) => i !== ch.id), page: 1 });
                    } else {
                      setFilters({ ...filters, channel_ids: [...ids, ch.id], page: 1 });
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {ch.profile_pic_url ? (
                  <img src={ch.profile_pic_url} alt="" className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-200" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{ch.display_name || ch.ig_username}</p>
                  <p className="text-[10px] text-gray-400">{ch.follower_count ? formatNumber(ch.follower_count) + ' followers' : ''}</p>
                </div>
              </label>
            );
          })}
        </div>
        {hasActiveChannel && (
          <button onClick={() => setFilters({ ...filters, channel_ids: [], page: 1 })} className="mt-2 text-[10px] text-gray-400 hover:text-gray-600">Clear</button>
        )}
      </Popover>

      {/* 2. Posted date */}
      <Popover
        trigger={<FilterPill label={dateLabel} active={hasActiveDate} />}
        open={openPopover === 'date'}
        onToggle={() => toggle('date')}
        onClose={close}
      >
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Posted date</p>
          <p className="text-[11px] text-gray-400 mb-3">How recently the video was posted</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Last</span>
            <input type="number" min={0} value={filters.posted_value ?? 0} onChange={(e) => setFilters({ ...filters, posted_value: Number(e.target.value), page: 1 })} className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
            <select value={filters.posted_unit || 'months'} onChange={(e) => setFilters({ ...filters, posted_unit: e.target.value as ExtendedFilters['posted_unit'], page: 1 })} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300">
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
            </select>
          </div>
          {hasActiveDate && (
            <button onClick={() => setFilters({ ...filters, posted_value: 0, page: 1 })} className="mt-2 text-[10px] text-gray-400 hover:text-gray-600">Clear</button>
          )}
        </div>
      </Popover>

      {/* 3. Platform */}
      <Popover
        trigger={<FilterPill label={platformLabel} active={hasActivePlatform} />}
        open={openPopover === 'platform'}
        onToggle={() => toggle('platform')}
        onClose={close}
      >
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Platform</p>
          <p className="text-[11px] text-gray-400 mb-3">Select which platforms to search</p>
          <div className="flex gap-2">
            {([
              { key: 'youtube' as const, label: 'YouTube', activeColor: 'bg-red-500 text-white border-transparent', icon: '▶' },
              { key: 'tiktok' as const, label: 'TikTok', activeColor: 'bg-gray-900 text-white border-transparent', icon: '🎵' },
              { key: 'instagram' as const, label: 'Instagram', activeColor: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent', icon: '📷' },
            ]).map((p) => {
              const active = filters.platforms?.[p.key] ?? false;
              return (
                <button key={p.key} onClick={() => {
                  const platforms = filters.platforms || { youtube: false, tiktok: false, instagram: false };
                  setFilters({ ...filters, platforms: { ...platforms, [p.key]: !active }, page: 1 });
                }} className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ${active ? p.activeColor : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {p.icon} {p.label}
                </button>
              );
            })}
          </div>
          {hasActivePlatform && (
            <button onClick={() => setFilters({ ...filters, platforms: { youtube: false, tiktok: false, instagram: false }, page: 1 })} className="mt-2 text-[10px] text-gray-400 hover:text-gray-600">Clear</button>
          )}
        </div>
      </Popover>

      {/* 4. Outlier score */}
      <Popover
        trigger={<FilterPill label={spikeLabel} active={hasActiveSpike} />}
        open={openPopover === 'spike'}
        onToggle={() => toggle('spike')}
        onClose={close}
      >
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Outlier score</p>
          <p className="text-[11px] text-gray-400 mb-3">Views / channel median views. Above 1x is good, above 5x is excellent</p>
          <div className="flex items-center gap-2">
            <input type="number" min={1} value={filters.min_spike ?? 1} onChange={(e) => setFilters({ ...filters, min_spike: Number(e.target.value), page: 1 })} className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
            <span className="text-xs text-gray-400">~</span>
            <input type="number" min={1} value={filters.max_spike ?? 100} onChange={(e) => setFilters({ ...filters, max_spike: Number(e.target.value), page: 1 })} className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
            <span className="text-xs text-gray-400">x</span>
          </div>
          {hasActiveSpike && (
            <button onClick={() => setFilters({ ...filters, min_spike: 1, max_spike: 100, page: 1 })} className="mt-2 text-[10px] text-gray-400 hover:text-gray-600">Clear</button>
          )}
        </div>
      </Popover>

      {/* 5. Views */}
      <Popover
        trigger={<FilterPill label={viewsLabel} active={hasActiveViews} />}
        open={openPopover === 'views'}
        onToggle={() => toggle('views')}
        onClose={close}
      >
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Views</p>
          <p className="text-[11px] text-gray-400 mb-3">More is usually better</p>
          <div className="flex items-center gap-2">
            <input type="number" min={0} value={filters.min_views ?? 0} onChange={(e) => setFilters({ ...filters, min_views: Number(e.target.value), page: 1 })} className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" placeholder="0" />
            <span className="text-xs text-gray-400">~</span>
            <input type="number" min={0} value={filters.max_views ?? 100000000} onChange={(e) => setFilters({ ...filters, max_views: Number(e.target.value), page: 1 })} className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" placeholder="100,000,000" />
          </div>
          {hasActiveViews && (
            <button onClick={() => setFilters({ ...filters, min_views: 0, max_views: 100000000, page: 1 })} className="mt-2 text-[10px] text-gray-400 hover:text-gray-600">Clear</button>
          )}
        </div>
      </Popover>

      {/* 6. Engagement rate */}
      <Popover
        trigger={<FilterPill label={engLabel} active={hasActiveEngagement} />}
        open={openPopover === 'engagement'}
        onToggle={() => toggle('engagement')}
        onClose={close}
      >
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Engagement rate</p>
          <p className="text-[11px] text-gray-400 mb-3">(Likes + comments) / views. Most videos are less than 2%, above 5% is great</p>
          <div className="flex items-center gap-2">
            <input type="number" min={0} max={100} value={filters.min_engagement_pct ?? 0} onChange={(e) => setFilters({ ...filters, min_engagement_pct: Number(e.target.value), page: 1 })} className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
            <span className="text-xs text-gray-400">%</span>
            <span className="text-xs text-gray-400">~</span>
            <input type="number" min={0} max={100} value={filters.max_engagement_pct ?? 100} onChange={(e) => setFilters({ ...filters, max_engagement_pct: Number(e.target.value), page: 1 })} className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
            <span className="text-xs text-gray-400">%</span>
          </div>
          {hasActiveEngagement && (
            <button onClick={() => setFilters({ ...filters, min_engagement_pct: 0, max_engagement_pct: 100, page: 1 })} className="mt-2 text-[10px] text-gray-400 hover:text-gray-600">Clear</button>
          )}
        </div>
      </Popover>

      {/* 7. Keywords */}
      <Popover
        trigger={<FilterPill label={filters.keyword ? `"${filters.keyword}"` : 'Keywords'} active={hasActiveKeyword} />}
        open={openPopover === 'keywords'}
        onToggle={() => toggle('keywords')}
        onClose={close}
      >
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Filter by keywords</p>
          <p className="text-[11px] text-gray-400 mb-3">Searches captions and titles</p>
          <input type="text" value={filters.keyword || ''} onChange={(e) => setFilters({ ...filters, keyword: e.target.value || undefined, page: 1 })} placeholder="Enter keywords" className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-300" />
          {hasActiveKeyword && (
            <button onClick={() => setFilters({ ...filters, keyword: undefined, page: 1 })} className="mt-2 text-[10px] text-gray-400 hover:text-gray-600">Clear</button>
          )}
        </div>
      </Popover>

      {/* 8. Sort by */}
      <Popover
        trigger={<FilterPill label={`Sort: ${sortOptions.find((o) => o.value === (filters.sort || 'spike'))?.label || 'Spike순'}`} active={false} />}
        open={openPopover === 'sort'}
        onToggle={() => toggle('sort')}
        onClose={close}
      >
        <div className="space-y-1">
          {sortOptions.map((o) => (
            <button key={o.value} onClick={() => { setFilters({ ...filters, sort: o.value as RadarFilters['sort'], page: 1 }); close(); }} className={`block w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${(filters.sort || 'spike') === o.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
              {o.label}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  );
}

// ─── Platform Badge (small circle) ───

function PlatformBadge({ platform }: { platform: string }) {
  if (platform === 'youtube') {
    return (
      <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-sm">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="white"><polygon points="4,2.5 4,7.5 8,5" /></svg>
      </div>
    );
  }
  if (platform === 'tiktok') {
    return (
      <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center shadow-sm">
        <span className="text-[10px]">🎵</span>
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shadow-sm">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.2"><rect x="1" y="1" width="8" height="8" rx="2" /><circle cx="5" cy="5" r="1.8" /><circle cx="7.2" cy="2.8" r="0.5" fill="white" /></svg>
    </div>
  );
}

// ─── Spike badge color ───

function spikeBadgeClass(v: number): string {
  if (v >= 10) return 'bg-red-100 text-red-700';
  if (v >= 5) return 'bg-orange-50 text-orange-600';
  if (v >= 2) return 'bg-rose-50 text-rose-600';
  return 'bg-gray-100 text-gray-500';
}

// ─── Reel Card ───

function ReelCard({ reel, onAnalyze, onToggleFavorite, isFavorited, analysisStatus }: { reel: RadarReel; onAnalyze: () => void; onToggleFavorite: () => void; isFavorited: boolean; analysisStatus?: { jobId: string; status: string } }) {
  const channel = reel.channel;
  const navigate = useNavigate();

  return (
    <div className="group cursor-pointer">
      {/* Thumbnail */}
      <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100">
        {reel.thumbnail_url ? (
          <img src={reel.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="20" rx="4" />
              <polygon points="10,8 16,12 10,16" fill="currentColor" />
            </svg>
          </div>
        )}

        {/* Analysis status badge — top-left */}
        {analysisStatus?.status === 'processing' && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/80 text-white text-[10px] font-medium backdrop-blur-sm cursor-default" onClick={(e) => e.stopPropagation()}>
            <Loader2 className="w-3 h-3 animate-spin" />
            분석중
          </div>
        )}
        {analysisStatus?.status === 'pending' && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/80 text-white text-[10px] font-medium backdrop-blur-sm cursor-default" onClick={(e) => e.stopPropagation()}>
            <Loader2 className="w-3 h-3 animate-spin" />
            대기중
          </div>
        )}
        {analysisStatus?.status === 'failed' && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/80 text-white text-[10px] font-medium backdrop-blur-sm cursor-default" onClick={(e) => e.stopPropagation()}>
            ❌ 실패
          </div>
        )}
        {(analysisStatus?.status === 'completed' || (!analysisStatus && reel.is_analyzed && reel.job_id)) && (
          <button
            onClick={(e) => { e.stopPropagation(); const jid = analysisStatus?.jobId || reel.job_id; if (jid) navigate(`/app/results/${jid}`); }}
            className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/80 text-white text-[10px] font-medium backdrop-blur-sm hover:bg-emerald-600/90 transition-colors"
          >
            ✅ 분석완료
          </button>
        )}

        {/* Platform badge — always visible, top-right */}
        <div className="absolute top-2 right-2">
          <PlatformBadge platform={reel.platform} />
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
            disabled={analysisStatus?.status === 'processing' || analysisStatus?.status === 'pending'}
            className="bg-white/90 text-gray-900 text-xs font-medium px-4 py-2 rounded-full hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analysisStatus?.status === 'processing' || analysisStatus?.status === 'pending' ? '🔄 분석중...' : '🔍 분석하기'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); const sc = reel.shortcode; const url = reel.platform === 'youtube' ? 'https://youtube.com/shorts/' + sc : reel.platform === 'tiktok' ? 'https://tiktok.com/@/video/' + sc : 'https://www.instagram.com/reel/' + sc + '/'; window.open(url, '_blank'); }}
            className="bg-white/20 text-white text-xs font-medium px-4 py-1.5 rounded-full hover:bg-white/30 transition-colors"
          >
            ▶ 영상보기
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className="text-white/80 text-xs hover:text-white transition-colors flex items-center gap-1"
          >
            <Heart className={`w-4 h-4 ${isFavorited ? 'fill-red-400 text-red-400' : ''}`} strokeWidth={1.5} />
          </button>
          {reel.caption && (
            <p className="absolute bottom-2 left-2 right-2 text-white/80 text-[10px] line-clamp-3">
              {reel.caption}
            </p>
          )}
        </div>
      </div>

      {/* Text area — compact 3 lines */}
      <div className="mt-1.5 px-0.5">
        <p className="text-xs font-medium text-gray-900 truncate">
          {reel.caption?.slice(0, 60) || '제목 없음'}
        </p>
        <div className="flex justify-between items-center mt-0.5">
          <span className="text-[10px] text-gray-500 truncate">@{channel?.ig_username || '—'}</span>
          <span className="text-[10px] text-gray-400 shrink-0">{reel.posted_at ? timeAgo(reel.posted_at) : ''}</span>
        </div>
        <div className="flex gap-1.5 mt-1">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${spikeBadgeClass(reel.spike_multiplier)}`}>
            🔺{reel.spike_multiplier.toFixed(1)}x
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium">
            👁 {formatNumber(reel.view_count)}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">
            ⚡{reel.engagement_rate.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}


// ─── Channel Management Modal ───

function ChannelModal({
  open,
  onClose,
  channels,
  onAdd,
  onDelete,
  onCollect,
}: {
  open: boolean;
  onClose: () => void;
  channels: RadarChannel[];
  onAdd: (username: string, category: string, platform: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCollect: (id: string) => Promise<void>;
}) {
  const [username, setUsername] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleAdd = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setError('');
    try {
      let input = username.trim();
      let detectedPlatform = platform;
      // Auto-detect platform from URL
      if (input.includes('instagram.com')) {
        detectedPlatform = 'instagram';
        const match = input.match(/instagram\.com\/([^/?]+)/);
        if (match) input = match[1];
      } else if (input.includes('youtube.com') || input.includes('youtu.be')) {
        detectedPlatform = 'youtube';
        const match = input.match(/@([^/?]+)/);
        if (match) input = match[1];
      } else if (input.includes('tiktok.com')) {
        detectedPlatform = 'tiktok';
        const match = input.match(/@([^/?]+)/);
        if (match) input = match[1];
      }
      input = input.replace(/^@/, '');
      await onAdd(input, 'general', detectedPlatform);
      setUsername('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '등록 실패';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md sm:mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">채널 관리</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l10 10M15 5L5 15" /></svg>
            </button>
          </div>

          {/* Platform selector */}
          <div className="flex items-center gap-2 mb-3">
            {([
              { id: 'instagram', label: 'Instagram', icon: '📷', activeClass: 'border-purple-300 bg-purple-50 text-purple-700' },
              { id: 'youtube', label: 'YouTube', icon: '▶', activeClass: 'border-red-300 bg-red-50 text-red-700' },
              { id: 'tiktok', label: 'TikTok', icon: '🎵', activeClass: 'border-gray-800 bg-gray-900 text-white' },
            ] as const).map((p) => (
              <button key={p.id} onClick={() => setPlatform(p.id)} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${platform === p.id ? `${p.activeClass} font-medium` : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {p.icon} {p.label}
              </button>
            ))}
          </div>

          {/* Add channel */}
          <div className="flex gap-2 mb-4">
            <input type="text" placeholder="계정명 또는 URL (예: @oliveyoung_official)" value={username} onChange={(e) => setUsername(e.target.value)} className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-300" onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
            <button onClick={handleAdd} disabled={loading || !username.trim()} className="text-sm font-medium px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors whitespace-nowrap">
              {loading ? '...' : '추가'}
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

          {/* Channel list */}
          <div className="space-y-2">
            {channels.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">등록된 채널이 없습니다</p>
            )}
            {channels.map((ch) => {
              const chPlatform = (ch as unknown as Record<string, unknown>).platform as string || 'instagram';
              return (
                <div key={ch.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  {ch.profile_pic_url ? (
                    <img src={ch.profile_pic_url} alt="" className="w-9 h-9 rounded-full" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
                      {chPlatform === 'youtube' ? 'YT' : chPlatform === 'tiktok' ? 'TT' : 'IG'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {chPlatform === 'youtube' ? (
                        <span className="bg-red-500 text-white px-1 py-px rounded text-[9px] font-bold">YT</span>
                      ) : chPlatform === 'tiktok' ? (
                        <span className="bg-gray-900 text-white px-1 py-px rounded text-[9px] font-bold">TT</span>
                      ) : (
                        <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-1 py-px rounded text-[9px] font-bold">IG</span>
                      )}
                      <p className="text-sm font-medium text-gray-900 truncate">{ch.display_name || ch.ig_username}</p>
                    </div>
                    <p className="text-xs text-gray-400">@{ch.ig_username}{ch.follower_count ? ` · ${formatNumber(ch.follower_count)}` : ''}</p>
                  </div>
                  <button onClick={() => onCollect(ch.id)} className="text-xs text-blue-500 hover:text-blue-700 mr-1" title="수집">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8a6 6 0 0112 0" /><path d="M14 8a6 6 0 01-12 0" /><path d="M8 4v4l2 2" /></svg>
                  </button>
                  <button onClick={() => onDelete(ch.id)} className="text-xs text-red-400 hover:text-red-600" title="삭제">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4L4 12" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───

export default function RadarPage() {
  const { t } = useTranslation();

  const [channels, setChannels] = useState<RadarChannel[]>([]);
  const [reels, setReels] = useState<RadarReel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState<ExtendedFilters>({
    sort: 'spike',
    page: 1,
    limit: 30,
  });

  const fetchChannels = useCallback(async () => {
    try {
      const data = await getRadarChannels();
      setChannels(data);
    } catch {
      // ignore
    }
  }, []);

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

  useEffect(() => { fetchChannels(); }, [fetchChannels]);
  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const handleAddChannel = async (username: string, category: string, platform: string) => {
    const newChannel = await addRadarChannel(username, category, platform);
    await fetchChannels();
    // Auto-collect reels for new channel
    if (newChannel?.id) {
      showToast('채널을 추가했습니다. 릴스 수집 중...', 'info');
      try {
        await collectChannel(newChannel.id);
        await fetchFeed();
        showToast('✅ 릴스 수집 완료', 'success');
      } catch (e) {
        console.error('Auto-collect failed:', e);
        showToast('채널은 추가했지만 릴스 수집에 실패했습니다', 'error', '채널 관리에서 수동 수집해주세요');
      }
    } else {
      await fetchFeed();
    }
  };

  const handleDeleteChannel = async (id: string) => {
    await deleteRadarChannel(id);
    await fetchChannels();
    await fetchFeed();
  };

  const handleCollect = async (id: string) => {
    await collectChannel(id);
    await fetchFeed();
  };



  // Analysis state tracking
  const [analyzingJobs, setAnalyzingJobs] = useState<Map<string, { jobId: string; status: string }>>(new Map());
  const [favoritedReels, setFavoritedReels] = useState<Set<string>>(new Set());
  const pollingRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingRef.current.forEach((interval) => clearInterval(interval));
    };
  }, []);

  const startPolling = useCallback((reelId: string, jobId: string) => {
    // Clear existing polling for this reel
    const existing = pollingRef.current.get(reelId);
    if (existing) clearInterval(existing);

    const startTime = Date.now();
    const interval = setInterval(async () => {
      // Check 10-minute timeout
      if (Date.now() - startTime > TIMEOUT_MS) {
        setAnalyzingJobs((prev) => {
          const next = new Map(prev);
          next.set(reelId, { jobId, status: 'failed' });
          return next;
        });
        clearInterval(interval);
        pollingRef.current.delete(reelId);
        showToast('❌ 분석에 실패했습니다', 'error', '다시 시도해주세요');
        return;
      }

      try {
        const job = await getJobStatus(jobId);
        if (job.status === 'completed') {
          setAnalyzingJobs((prev) => {
            const next = new Map(prev);
            next.set(reelId, { jobId, status: 'completed' });
            return next;
          });
          clearInterval(interval);
          pollingRef.current.delete(reelId);
          showToast('✅ 분석이 완료되었습니다', 'success', '분석 탭에서 결과를 확인하세요');
          // Auto-save to library
          const reel = reels.find(r => r.id === reelId);
          if (reel) {
            addLibraryItem({
              platform: reel.platform || 'instagram',
              source: 'analysis',
              original_url: reel.video_url || '',
              video_url: reel.video_url || '',
              title: reel.caption?.slice(0, 80) || 'Untitled',
              thumbnail_url: reel.thumbnail_url || '',
              channel_name: reel.channel?.ig_username || '',
              job_id: jobId,
              tags: [],
            }).catch(() => {});
          }
        } else if (job.status === 'failed') {
          setAnalyzingJobs((prev) => {
            const next = new Map(prev);
            next.set(reelId, { jobId, status: 'failed' });
            return next;
          });
          clearInterval(interval);
          pollingRef.current.delete(reelId);
          showToast('❌ 분석에 실패했습니다', 'error', '다시 시도해주세요');
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);

    pollingRef.current.set(reelId, interval);
  }, []);

  const handleAnalyze = async (reel: RadarReel) => {
    // Don't start if already analyzing
    const existing = analyzingJobs.get(reel.id);
    if (existing && (existing.status === 'processing' || existing.status === 'pending')) return;

    let videoUrl: string;
    if (reel.platform === 'youtube') {
      videoUrl = `https://www.youtube.com/shorts/${reel.shortcode}`;
    } else if (reel.platform === 'tiktok') {
      videoUrl = reel.video_url || `https://www.tiktok.com/video/${reel.shortcode}`;
    } else {
      videoUrl = reel.video_url || `https://www.instagram.com/reel/${reel.shortcode}/`;
    }

    try {
      setAnalyzingJobs((prev) => {
        const next = new Map(prev);
        next.set(reel.id, { jobId: '', status: 'pending' });
        return next;
      });

      const { id: jobId } = await createJobFromUrl(videoUrl, undefined, undefined, {
        title: reel.caption?.slice(0, 80) || reel.shortcode || 'Untitled',
        thumbnail_url: reel.thumbnail_url || '',
        channel_name: reel.channel?.ig_username || '',
        source_url: videoUrl,
        posted_at: reel.posted_at || undefined,
      });

      setAnalyzingJobs((prev) => {
        const next = new Map(prev);
        next.set(reel.id, { jobId, status: 'processing' });
        return next;
      });

      showToast('🔍 분석을 시작했습니다', 'info', '완료되면 분석 탭에서 결과를 확인하세요');
      startPolling(reel.id, jobId);
    } catch (e) {
      setAnalyzingJobs((prev) => {
        const next = new Map(prev);
        next.delete(reel.id);
        return next;
      });
      const msg = e instanceof Error ? e.message : '분석 시작에 실패했습니다';
      showToast(msg, 'error');
    }
  };

  const handleToggleFavorite = async (reel: RadarReel) => {
    const isFav = favoritedReels.has(reel.id);
    if (isFav) {
      setFavoritedReels((prev) => { const next = new Set(prev); next.delete(reel.id); return next; });
      showToast('즐겨찾기에서 제거했습니다', 'info');
      // TODO: call remove from library API if needed
    } else {
      try {
        const ch = reel.channel;
        await addLibraryItem({
          platform: reel.platform,
          source: 'radar',
          original_url: reel.platform === 'youtube'
            ? `https://www.youtube.com/shorts/${reel.shortcode}`
            : reel.platform === 'tiktok'
              ? reel.video_url || `https://www.tiktok.com/video/${reel.shortcode}`
              : `https://www.instagram.com/reel/${reel.shortcode}/`,
          video_url: reel.video_url,
          thumbnail_url: reel.thumbnail_url,
          title: reel.caption?.slice(0, 100) || '',
          channel_name: ch?.ig_username || '',
          view_count: reel.view_count,
          like_count: reel.like_count,
          comment_count: reel.comment_count,
          spike_multiplier: reel.spike_multiplier,
        } as Partial<LibraryItem>);
        setFavoritedReels((prev) => new Set(prev).add(reel.id));
        showToast('즐겨찾기에 추가했습니다', 'success');
      } catch {
        showToast('즐겨찾기 추가에 실패했습니다', 'error');
      }
    }
  };

  const totalPages = Math.ceil(total / (filters.limit || 30));

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">{t('radar.title', '레이더')}</h1>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
          ⚙️ {t('radar.channelManage', '채널 관리')}
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-5">{t('radar.subtitle', '떡상한 영상을 찾아 분석하고 저장하세요')}</p>

      {/* Filter Bar */}
      <div className="bg-white border-b border-gray-200 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-5">
        <FilterBar filters={filters} setFilters={setFilters} channels={channels} />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
        </div>
      ) : channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">아직 등록된 채널이 없습니다</p>
          <p className="text-xs text-gray-400 mb-4">채널을 추가하면 떡상 영상을 자동으로 수집합니다</p>
          <button onClick={() => setModalOpen(true)} className="text-xs font-medium px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors">
            + 채널 추가하기
          </button>
        </div>
      ) : reels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          </div>
          <p className="text-sm text-gray-500">{t('radar.empty', '수집된 영상이 없습니다')}</p>
          <p className="text-xs text-gray-400 mt-1">{t('radar.emptyHint', '채널을 추가하고 수집을 시작하세요')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {reels.map((reel) => (
              <ReelCard key={reel.id} reel={reel} onAnalyze={() => handleAnalyze(reel)} onToggleFavorite={() => handleToggleFavorite(reel)} isFavorited={favoritedReels.has(reel.id)} analysisStatus={analyzingJobs.get(reel.id)} />
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

      <ChannelModal open={modalOpen} onClose={() => setModalOpen(false)} channels={channels} onAdd={handleAddChannel} onDelete={handleDeleteChannel} onCollect={handleCollect} />
    </div>
  );
}
