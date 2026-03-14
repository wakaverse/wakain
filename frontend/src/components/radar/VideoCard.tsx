import { useNavigate } from 'react-router-dom';
import { Heart, Loader2 } from 'lucide-react';
import type { RadarReel } from '../../types';

// ─── Helpers ───

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return '방금';
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

function spikeBadgeClass(v: number): string {
  if (v >= 10) return 'bg-red-100 text-red-700';
  if (v >= 5) return 'bg-orange-50 text-orange-600';
  if (v >= 2) return 'bg-rose-50 text-rose-600';
  return 'bg-gray-100 text-gray-500';
}

export function PlatformBadge({ platform }: { platform: string }) {
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

// ─── VideoCard ───

interface VideoCardProps {
  reel: RadarReel;
  onAnalyze: () => void;
  onToggleFavorite: () => void;
  isFavorited: boolean;
  analysisStatus?: { jobId: string; status: string };
  isNew?: boolean;
  isSelected?: boolean;
  onSelect?: (reelId: string) => void;
  showCompareCheckbox?: boolean;
}

export default function VideoCard({
  reel,
  onAnalyze,
  onToggleFavorite,
  isFavorited,
  analysisStatus,
  isNew,
  isSelected,
  onSelect,
  showCompareCheckbox,
}: VideoCardProps) {
  const channel = reel.channel;
  const navigate = useNavigate();
  const channelName = channel?.ig_username || reel.channel_name || '';
  const isAnalyzed = analysisStatus?.status === 'completed' || (!analysisStatus && reel.is_analyzed && reel.job_id);

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

        {/* New badge */}
        {isNew && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-yellow-400 text-yellow-900 text-[10px] font-bold">
            NEW
          </div>
        )}

        {/* Analysis status badge */}
        {!isNew && analysisStatus?.status === 'processing' && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/80 text-white text-[10px] font-medium backdrop-blur-sm cursor-default" onClick={(e) => e.stopPropagation()}>
            <Loader2 className="w-3 h-3 animate-spin" />
            분석중
          </div>
        )}
        {!isNew && analysisStatus?.status === 'pending' && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/80 text-white text-[10px] font-medium backdrop-blur-sm cursor-default" onClick={(e) => e.stopPropagation()}>
            <Loader2 className="w-3 h-3 animate-spin" />
            대기중
          </div>
        )}
        {!isNew && analysisStatus?.status === 'failed' && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/80 text-white text-[10px] font-medium backdrop-blur-sm cursor-default" onClick={(e) => e.stopPropagation()}>
            실패
          </div>
        )}
        {!isNew && isAnalyzed && (
          <button
            onClick={(e) => { e.stopPropagation(); const jid = analysisStatus?.jobId || reel.job_id; if (jid) navigate(`/app/results/${jid}`); }}
            className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/80 text-white text-[10px] font-medium backdrop-blur-sm hover:bg-emerald-600/90 transition-colors"
          >
            분석완료
          </button>
        )}

        {/* Platform badge */}
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
            {analysisStatus?.status === 'processing' || analysisStatus?.status === 'pending' ? '분석중...' : isAnalyzed ? '리포트 보기' : '분석하기'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); const sc = reel.shortcode; const url = reel.platform === 'youtube' ? 'https://youtube.com/shorts/' + sc : reel.platform === 'tiktok' ? 'https://tiktok.com/@/video/' + sc : 'https://www.instagram.com/reel/' + sc + '/'; window.open(url, '_blank'); }}
            className="bg-white/20 text-white text-xs font-medium px-4 py-1.5 rounded-full hover:bg-white/30 transition-colors"
          >
            영상보기
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className="text-white/80 text-xs hover:text-white transition-colors flex items-center gap-1"
          >
            <Heart className={`w-4 h-4 ${isFavorited ? 'fill-red-400 text-red-400' : ''}`} strokeWidth={1.5} />
          </button>
          {/* Guide button for analyzed reels */}
          {isAnalyzed && reel.job_id && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/app/guide?ref=${reel.job_id}`); }}
              className="bg-white/20 text-white text-[10px] font-medium px-3 py-1 rounded-full hover:bg-white/30 transition-colors"
            >
              이 구조로 제작가이드
            </button>
          )}
          {reel.caption && (
            <p className="absolute bottom-2 left-2 right-2 text-white/80 text-[10px] line-clamp-3">
              {reel.caption}
            </p>
          )}
        </div>
      </div>

      {/* Text area */}
      <div className="mt-1.5 px-0.5">
        <p className="text-xs font-medium text-gray-900 truncate">
          {reel.caption?.slice(0, 60) || '제목 없음'}
        </p>
        <div className="flex justify-between items-center mt-0.5">
          <span className="text-[10px] text-gray-500 truncate">@{channelName || '—'}</span>
          <span className="text-[10px] text-gray-400 shrink-0">{reel.posted_at ? timeAgo(reel.posted_at) : ''}</span>
        </div>
        <div className="flex gap-1.5 mt-1 items-center">
          {reel.spike_multiplier > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${spikeBadgeClass(reel.spike_multiplier)}`}>
              {reel.spike_multiplier.toFixed(1)}x
            </span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium">
            {formatNumber(reel.view_count)}
          </span>
          {reel.engagement_rate > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">
              {reel.engagement_rate.toFixed(1)}%
            </span>
          )}
          {showCompareCheckbox && (
            <label className="ml-auto flex items-center" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isSelected || false}
                onChange={() => onSelect?.(reel.id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
