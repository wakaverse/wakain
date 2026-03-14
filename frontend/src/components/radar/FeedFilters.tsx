import { useState, useEffect, useRef } from 'react';
import type { RadarChannel, RadarFilters } from '../../types';
import { formatNumber } from './VideoCard';

// ─── Extended filter state ───

export interface ExtendedFilters extends RadarFilters {
  posted_value?: number;
  posted_unit?: 'days' | 'weeks' | 'months';
  platforms?: { youtube: boolean; tiktok: boolean; instagram: boolean };
  max_spike?: number;
  max_views?: number;
  min_engagement_pct?: number;
  max_engagement_pct?: number;
  channel_ids?: string[];
}

export function filtersToApi(f: ExtendedFilters): RadarFilters {
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

  if (f.min_spike && f.min_spike > 1) api.min_spike = f.min_spike;
  if (f.min_views && f.min_views > 0) api.min_views = f.min_views;
  if (f.min_engagement_pct && f.min_engagement_pct > 0) api.min_engagement = f.min_engagement_pct;
  if (f.keyword) api.keyword = f.keyword;

  return api;
}

// ─── Popover ───

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

function FilterPill({ label, active }: { label: string; active: boolean }) {
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

// ─── Filter Bar ───

export default function FeedFilters({
  filters,
  setFilters,
  channels,
  showChannelFilter = true,
  showSpikeFilter = true,
}: {
  filters: ExtendedFilters;
  setFilters: (f: ExtendedFilters) => void;
  channels: RadarChannel[];
  showChannelFilter?: boolean;
  showSpikeFilter?: boolean;
}) {
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const toggle = (key: string) => setOpenPopover(openPopover === key ? null : key);
  const close = () => setOpenPopover(null);

  const hasActiveChannel = (filters.channel_ids?.length ?? 0) > 0;
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
      {/* Channel select */}
      {showChannelFilter && (
        <Popover trigger={<FilterPill label={channelLabel} active={hasActiveChannel} />} open={openPopover === 'search'} onToggle={() => toggle('search')} onClose={close}>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {channels.length === 0 && <p className="text-xs text-gray-400 py-2">등록된 채널이 없습니다</p>}
            {channels.map((ch) => {
              const checked = filters.channel_ids?.includes(ch.id) ?? false;
              return (
                <label key={ch.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={() => { const ids = filters.channel_ids ? [...filters.channel_ids] : []; if (checked) setFilters({ ...filters, channel_ids: ids.filter((i) => i !== ch.id), page: 1 }); else setFilters({ ...filters, channel_ids: [...ids, ch.id], page: 1 }); }} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  {ch.profile_pic_url ? <img src={ch.profile_pic_url} alt="" className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 rounded-full bg-gray-200" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{ch.display_name || ch.ig_username}</p>
                    <p className="text-[10px] text-gray-400">{ch.follower_count ? formatNumber(ch.follower_count) + ' followers' : ''}</p>
                  </div>
                </label>
              );
            })}
          </div>
          {hasActiveChannel && <button onClick={() => setFilters({ ...filters, channel_ids: [], page: 1 })} className="mt-2 text-[10px] text-gray-400 hover:text-gray-600">Clear</button>}
        </Popover>
      )}

      {/* Posted date */}
      <Popover trigger={<FilterPill label={dateLabel} active={hasActiveDate} />} open={openPopover === 'date'} onToggle={() => toggle('date')} onClose={close}>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Posted date</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Last</span>
            <input type="number" min={0} value={filters.posted_value ?? 0} onChange={(e) => setFilters({ ...filters, posted_value: Number(e.target.value), page: 1 })} className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
            <select value={filters.posted_unit || 'months'} onChange={(e) => setFilters({ ...filters, posted_unit: e.target.value as ExtendedFilters['posted_unit'], page: 1 })} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300">
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
            </select>
          </div>
          {hasActiveDate && <button onClick={() => setFilters({ ...filters, posted_value: 0, page: 1 })} className="mt-2 text-[10px] text-gray-400 hover:text-gray-600">Clear</button>}
        </div>
      </Popover>

      {/* Platform */}
      <Popover trigger={<FilterPill label={platformLabel} active={hasActivePlatform} />} open={openPopover === 'platform'} onToggle={() => toggle('platform')} onClose={close}>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Platform</p>
          <div className="flex gap-2">
            {([
              { key: 'youtube' as const, label: 'YouTube', activeColor: 'bg-red-500 text-white border-transparent', icon: '▶' },
              { key: 'tiktok' as const, label: 'TikTok', activeColor: 'bg-gray-900 text-white border-transparent', icon: '🎵' },
              { key: 'instagram' as const, label: 'Instagram', activeColor: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent', icon: '📷' },
            ]).map((p) => {
              const active = filters.platforms?.[p.key] ?? false;
              return (
                <button key={p.key} onClick={() => { const platforms = filters.platforms || { youtube: false, tiktok: false, instagram: false }; setFilters({ ...filters, platforms: { ...platforms, [p.key]: !active }, page: 1 }); }} className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ${active ? p.activeColor : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {p.icon} {p.label}
                </button>
              );
            })}
          </div>
          {hasActivePlatform && <button onClick={() => setFilters({ ...filters, platforms: { youtube: false, tiktok: false, instagram: false }, page: 1 })} className="mt-2 text-[10px] text-gray-400 hover:text-gray-600">Clear</button>}
        </div>
      </Popover>

      {/* Outlier score */}
      {showSpikeFilter && (
        <Popover trigger={<FilterPill label={spikeLabel} active={hasActiveSpike} />} open={openPopover === 'spike'} onToggle={() => toggle('spike')} onClose={close}>
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Outlier score</p>
            <div className="flex items-center gap-2">
              <input type="number" min={1} value={filters.min_spike ?? 1} onChange={(e) => setFilters({ ...filters, min_spike: Number(e.target.value), page: 1 })} className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
              <span className="text-xs text-gray-400">~</span>
              <input type="number" min={1} value={filters.max_spike ?? 100} onChange={(e) => setFilters({ ...filters, max_spike: Number(e.target.value), page: 1 })} className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
              <span className="text-xs text-gray-400">x</span>
            </div>
            {hasActiveSpike && <button onClick={() => setFilters({ ...filters, min_spike: 1, max_spike: 100, page: 1 })} className="mt-2 text-[10px] text-gray-400 hover:text-gray-600">Clear</button>}
          </div>
        </Popover>
      )}

      {/* Views */}
      <Popover trigger={<FilterPill label={viewsLabel} active={hasActiveViews} />} open={openPopover === 'views'} onToggle={() => toggle('views')} onClose={close}>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Views</p>
          <div className="flex items-center gap-2">
            <input type="number" min={0} value={filters.min_views ?? 0} onChange={(e) => setFilters({ ...filters, min_views: Number(e.target.value), page: 1 })} className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" placeholder="0" />
            <span className="text-xs text-gray-400">~</span>
            <input type="number" min={0} value={filters.max_views ?? 100000000} onChange={(e) => setFilters({ ...filters, max_views: Number(e.target.value), page: 1 })} className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
          </div>
          {hasActiveViews && <button onClick={() => setFilters({ ...filters, min_views: 0, max_views: 100000000, page: 1 })} className="mt-2 text-[10px] text-gray-400 hover:text-gray-600">Clear</button>}
        </div>
      </Popover>

      {/* Engagement */}
      <Popover trigger={<FilterPill label={engLabel} active={hasActiveEngagement} />} open={openPopover === 'engagement'} onToggle={() => toggle('engagement')} onClose={close}>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Engagement rate</p>
          <div className="flex items-center gap-2">
            <input type="number" min={0} max={100} value={filters.min_engagement_pct ?? 0} onChange={(e) => setFilters({ ...filters, min_engagement_pct: Number(e.target.value), page: 1 })} className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
            <span className="text-xs text-gray-400">%~</span>
            <input type="number" min={0} max={100} value={filters.max_engagement_pct ?? 100} onChange={(e) => setFilters({ ...filters, max_engagement_pct: Number(e.target.value), page: 1 })} className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
            <span className="text-xs text-gray-400">%</span>
          </div>
          {hasActiveEngagement && <button onClick={() => setFilters({ ...filters, min_engagement_pct: 0, max_engagement_pct: 100, page: 1 })} className="mt-2 text-[10px] text-gray-400 hover:text-gray-600">Clear</button>}
        </div>
      </Popover>

      {/* Keywords */}
      <Popover trigger={<FilterPill label={filters.keyword ? `"${filters.keyword}"` : 'Keywords'} active={hasActiveKeyword} />} open={openPopover === 'keywords'} onToggle={() => toggle('keywords')} onClose={close}>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Filter by keywords</p>
          <input type="text" value={filters.keyword || ''} onChange={(e) => setFilters({ ...filters, keyword: e.target.value || undefined, page: 1 })} placeholder="Enter keywords" className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-300" />
          {hasActiveKeyword && <button onClick={() => setFilters({ ...filters, keyword: undefined, page: 1 })} className="mt-2 text-[10px] text-gray-400 hover:text-gray-600">Clear</button>}
        </div>
      </Popover>

      {/* Sort */}
      <Popover trigger={<FilterPill label={`Sort: ${sortOptions.find((o) => o.value === (filters.sort || 'spike'))?.label || 'Spike순'}`} active={false} />} open={openPopover === 'sort'} onToggle={() => toggle('sort')} onClose={close}>
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
