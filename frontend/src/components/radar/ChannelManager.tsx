import { useState } from 'react';
import type { RadarChannel } from '../../types';
import { formatNumber, timeAgo } from './VideoCard';

interface ChannelManagerProps {
  open: boolean;
  onClose: () => void;
  channels: RadarChannel[];
  onAdd: (username: string, category: string, platform: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCollect: (id: string) => Promise<void>;
}

export default function ChannelManager({ open, onClose, channels, onAdd, onDelete, onCollect }: ChannelManagerProps) {
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

          <div className="flex gap-2 mb-4">
            <input type="text" placeholder="계정명 또는 URL" value={username} onChange={(e) => setUsername(e.target.value)} className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-300" onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
            <button onClick={handleAdd} disabled={loading || !username.trim()} className="text-sm font-medium px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors whitespace-nowrap">
              {loading ? '...' : '추가'}
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

          <div className="space-y-2">
            {channels.length === 0 && <p className="text-sm text-gray-400 text-center py-6">등록된 채널이 없습니다</p>}
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
                    {ch.last_error && (
                      <p className="text-[10px] text-amber-600 mt-0.5" title={ch.last_error}>
                        ⚠️ 업데이트 실패 {ch.last_error_at ? `(${timeAgo(ch.last_error_at)})` : ''}
                      </p>
                    )}
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
