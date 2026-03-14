import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchContentLibrary, fetchContentFilters } from '../../lib/admin';

interface ContentRow {
  result_id: string;
  job_id: string;
  video_name: string;
  thumbnail_url: string | null;
  user_email: string;
  user_id: string;
  platform: string | null;
  category: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

export default function AdminContentPage() {
  const [items, setItems] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Filters
  const [category, setCategory] = useState('');
  const [platform, setPlatform] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // Filter options
  const [categories, setCategories] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);

  useEffect(() => {
    fetchContentFilters().then(({ categories: cats, platforms: plats }) => {
      setCategories(cats);
      setPlatforms(plats);
    });
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchContentLibrary({
        category,
        platform,
        userSearch,
        offset: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setItems(data);
    } catch (err) {
      console.error('Content load error:', err);
    } finally {
      setLoading(false);
    }
  }, [category, platform, userSearch, page]);

  useEffect(() => {
    const debounce = setTimeout(loadItems, 300);
    return () => clearTimeout(debounce);
  }, [loadItems]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [category, platform, userSearch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">콘텐츠 라이브러리</h1>
        <button onClick={loadItems} disabled={loading} className="p-2 text-gray-400 hover:text-gray-600">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="사용자 이메일 검색..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
        >
          <option value="">전체 카테고리</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
        >
          <option value="">전체 플랫폼</option>
          {platforms.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Content Table */}
      <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 w-12"></th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500">영상 제목</th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500">사용자</th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500">플랫폼</th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500">카테고리</th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500">분석일</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-gray-400">콘텐츠 없음</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.result_id}
                    onClick={() => window.open(`/app/results/${item.result_id}`, '_blank')}
                    className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-2 px-3">
                      {item.thumbnail_url ? (
                        <img
                          src={item.thumbnail_url}
                          alt=""
                          className="w-10 h-10 rounded object-cover bg-gray-100"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                          N/A
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-gray-900 font-medium truncate max-w-[250px]">
                      {item.video_name || '(제목 없음)'}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs truncate max-w-[180px]">
                      {item.user_email}
                    </td>
                    <td className="py-2.5 px-3">
                      {item.platform ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {item.platform}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {item.category ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                          {item.category}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">
          {items.length > 0 && `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + items.length}건`}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600">{page + 1}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={items.length < PAGE_SIZE}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
