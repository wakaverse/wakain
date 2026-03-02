import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Star, Trash2, Search, SlidersHorizontal } from 'lucide-react';
import {
  getLibraryItems,
  updateLibraryItem,
  deleteLibraryItem,
} from '../lib/api';
import type { LibraryItem, LibraryFilters } from '../types';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function platformBadge(platform: string) {
  if (platform === 'youtube') return <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-md text-[10px] font-bold">YT</span>;
  if (platform === 'tiktok') return <span className="bg-gray-900 text-white px-1.5 py-0.5 rounded-md text-[10px] font-bold">TT</span>;
  return <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-1.5 py-0.5 rounded-md text-[10px] font-bold">IG</span>;
}

function sourceLabel(source: string): string {
  if (source === 'radar') return '레이더';
  if (source === 'hack') return '분석';
  return '직접추가';
}

const SOURCE_OPTIONS = [
  { value: '', label: '전체 소스' },
  { value: 'radar', label: '레이더' },
  { value: 'hack', label: '분석' },
  { value: 'manual', label: '직접추가' },
];

const PLATFORM_OPTIONS = [
  { value: '', label: '전체 플랫폼' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
];

const SORT_OPTIONS = [
  { value: 'recent', label: '최신순' },
  { value: 'starred', label: '즐겨찾기' },
  { value: 'views', label: '조회순' },
  { value: 'spike', label: 'Spike순' },
];

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function LibraryCard({
  item,
  onHack,
  onToggleStar,
  onDelete,
}: {
  item: LibraryItem;
  onHack: () => void;
  onToggleStar: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="relative aspect-[9/16] bg-gray-100">
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="20" rx="4" />
              <polygon points="10,8 16,12 10,16" fill="currentColor" />
            </svg>
          </div>
        )}
        <div className="absolute top-2 right-2">{platformBadge(item.platform)}</div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
          className="absolute top-2 left-2 p-1 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors"
        >
          <Star
            className={`w-4 h-4 ${item.is_starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`}
            strokeWidth={1.5}
          />
        </button>
        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/40 text-white text-[9px]">
          {sourceLabel(item.source)}
        </div>
      </div>

      <div className="p-3 flex flex-col gap-1.5 flex-1">
        {item.title && (
          <p className="text-[11px] text-gray-700 font-medium line-clamp-2 leading-tight">{item.title}</p>
        )}
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <span>👁 {formatNumber(item.view_count)}</span>
          <span>❤️ {formatNumber(item.like_count)}</span>
          <span>💬 {formatNumber(item.comment_count)}</span>
        </div>
        {item.channel_name && (
          <span className="text-[11px] text-gray-400 truncate">@{item.channel_name}</span>
        )}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{tag}</span>
            ))}
          </div>
        )}
        {item.memo && (
          <p className="text-[10px] text-gray-400 line-clamp-1 italic">📝 {item.memo}</p>
        )}
        <div className="flex gap-1.5 mt-auto pt-1">
          <button onClick={onHack} className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors">
            분석하기
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors">
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [items, setItems] = useState<LibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<LibraryFilters>({
    sort: 'recent',
    page: 1,
    limit: 30,
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLibraryItems(filters);
      setItems(data.items);
      setTotal(data.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleToggleStar = async (item: LibraryItem) => {
    try {
      await updateLibraryItem(item.id, { is_starred: !item.is_starred });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_starred: !i.is_starred } : i)));
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLibraryItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setTotal((prev) => prev - 1);
    } catch { /* ignore */ }
  };

  const handleHack = (item: LibraryItem) => {
    const url = item.original_url || item.video_url;
    if (url) navigate(`/app/hack?url=${encodeURIComponent(url)}`);
  };

  const totalPages = Math.ceil(total / (filters.limit || 30));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('library.title', '라이브러리')}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{t('library.subtitle', '저장한 영상을 관리하세요')}</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
          필터
        </button>
      </div>

      <div className="space-y-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="키워드 검색"
            value={filters.keyword || ''}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value || undefined, page: 1 })}
            className="w-full text-sm bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-2">
            <Select value={filters.source || ''} onChange={(v) => setFilters({ ...filters, source: v || undefined, page: 1 })} options={SOURCE_OPTIONS} />
            <Select value={filters.platform || ''} onChange={(v) => setFilters({ ...filters, platform: v || undefined, page: 1 })} options={PLATFORM_OPTIONS} />
            <Select value={filters.sort || 'recent'} onChange={(v) => setFilters({ ...filters, sort: v as LibraryFilters['sort'], page: 1 })} options={SORT_OPTIONS} />
            <button
              onClick={() => setFilters({ ...filters, starred: filters.starred ? undefined : true, page: 1 })}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${filters.starred ? 'border-yellow-300 bg-yellow-50 text-yellow-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            >
              ⭐ 즐겨찾기만
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Star className="w-7 h-7 text-gray-300" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-gray-500">{t('library.empty', '아직 저장된 영상이 없습니다')}</p>
          <p className="text-xs text-gray-400 mt-1">{t('library.emptyHint', '레이더에서 영상을 저장하거나 분석해보세요')}</p>
          <button onClick={() => navigate('/app/radar')} className="mt-4 text-xs font-medium px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800">
            레이더로 이동
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((item) => (
              <LibraryCard key={item.id} item={item} onHack={() => handleHack(item)} onToggleStar={() => handleToggleStar(item)} onDelete={() => handleDelete(item.id)} />
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
