import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getRadarChannels,
  addRadarChannel,
  deleteRadarChannel,
  collectChannel,
  addLibraryItem,
  analyzeRadarReel,
  getJobStatus,
  getLastRadarVisit,
  updateLastRadarVisit,
  logRadarEvent,
} from '../lib/api';
import type { RadarChannel, RadarReel, LibraryItem } from '../types';
import { showToast } from '../hooks/useToast';

import WatchTab from '../components/radar/WatchTab';
import TrendTab from '../components/radar/TrendTab';
import SearchTab from '../components/radar/SearchTab';
import ChannelManager from '../components/radar/ChannelManager';
import CompareBar from '../components/radar/CompareBar';

type RadarTab = 'watch' | 'trend' | 'search';

const TIMEOUT_MS = 10 * 60 * 1000;

export default function RadarPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<RadarTab>('watch');
  const [channels, setChannels] = useState<RadarChannel[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [lastRadarVisit, setLastRadarVisitState] = useState<string | null>(null);

  // Analysis state tracking
  const [analyzingJobs, setAnalyzingJobs] = useState<Map<string, { jobId: string; status: string }>>(new Map());
  const [favoritedReels, setFavoritedReels] = useState<Set<string>>(new Set());
  const pollingRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Compare selection (shared across tabs)
  const [selectedReelIds, setSelectedReelIds] = useState<Set<string>>(new Set());
  const [selectedReelData, setSelectedReelData] = useState<RadarReel[]>([]);

  // Fetch channels
  const fetchChannels = useCallback(async () => {
    try {
      const data = await getRadarChannels();
      setChannels(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  // Load last radar visit for new badge
  useEffect(() => {
    getLastRadarVisit().then((v) => setLastRadarVisitState(v)).catch(() => {});
    // Update visit timestamp on mount
    updateLastRadarVisit().catch(() => {});
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingRef.current.forEach((interval) => clearInterval(interval));
    };
  }, []);

  // Tab switch event
  const handleTabSwitch = (tab: RadarTab) => {
    setActiveTab(tab);
    logRadarEvent('radar_tab_switch', { tab }).catch(() => {});
  };

  // ─── Channel Management ───

  const handleAddChannel = async (username: string, category: string, platform: string) => {
    const newChannel = await addRadarChannel(username, category, platform);
    await fetchChannels();
    if (newChannel?.id) {
      showToast('채널을 추가했습니다. 릴스 수집 중...', 'info');
      logRadarEvent('radar_channel_add', { platform, channel_name: username }).catch(() => {});
      try {
        await collectChannel(newChannel.id);
        showToast('릴스 수집 완료', 'success');
      } catch {
        showToast('채널은 추가했지만 릴스 수집에 실패했습니다', 'error');
      }
    }
  };

  const handleDeleteChannel = async (id: string) => {
    await deleteRadarChannel(id);
    await fetchChannels();
  };

  const handleCollect = async (id: string) => {
    logRadarEvent('radar_collect', { channel_id: id }).catch(() => {});
    await collectChannel(id);
  };

  // ─── Analysis ───

  const startPolling = useCallback((reelId: string, jobId: string, reel?: RadarReel) => {
    const existing = pollingRef.current.get(reelId);
    if (existing) clearInterval(existing);

    const startTime = Date.now();
    const interval = setInterval(async () => {
      if (Date.now() - startTime > TIMEOUT_MS) {
        setAnalyzingJobs((prev) => { const next = new Map(prev); next.set(reelId, { jobId, status: 'failed' }); return next; });
        clearInterval(interval);
        pollingRef.current.delete(reelId);
        showToast('분석에 실패했습니다', 'error');
        return;
      }
      try {
        const job = await getJobStatus(jobId);
        if (job.status === 'completed') {
          setAnalyzingJobs((prev) => { const next = new Map(prev); next.set(reelId, { jobId, status: 'completed' }); return next; });
          clearInterval(interval);
          pollingRef.current.delete(reelId);
          showToast('분석이 완료되었습니다', 'success');
          if (reel) {
            addLibraryItem({
              platform: reel.platform || 'instagram',
              source: 'analysis',
              original_url: reel.video_url || '',
              video_url: reel.video_url || '',
              title: reel.caption?.slice(0, 80) || 'Untitled',
              thumbnail_url: reel.thumbnail_url || '',
              channel_name: reel.channel?.ig_username || reel.channel_name || '',
              job_id: jobId,
              tags: [],
            }).catch(() => {});
          }
        } else if (job.status === 'failed') {
          setAnalyzingJobs((prev) => { const next = new Map(prev); next.set(reelId, { jobId, status: 'failed' }); return next; });
          clearInterval(interval);
          pollingRef.current.delete(reelId);
          showToast('분석에 실패했습니다', 'error');
        }
      } catch { /* ignore */ }
    }, 5000);
    pollingRef.current.set(reelId, interval);
  }, []);

  const handleAnalyze = async (reel: RadarReel) => {
    const existing = analyzingJobs.get(reel.id);
    if (existing && (existing.status === 'processing' || existing.status === 'pending')) return;
    if (reel.is_analyzed && reel.job_id) {
      navigate(`/app/results/${reel.job_id}`);
      return;
    }

    try {
      setAnalyzingJobs((prev) => { const next = new Map(prev); next.set(reel.id, { jobId: '', status: 'pending' }); return next; });
      const { job_id: jobId } = await analyzeRadarReel(reel.id);
      setAnalyzingJobs((prev) => { const next = new Map(prev); next.set(reel.id, { jobId, status: 'processing' }); return next; });
      logRadarEvent('radar_analyze_click', { reel_id: reel.id, source: reel.source || 'channel', platform: reel.platform }).catch(() => {});
      showToast('분석을 시작했습니다', 'info');
      startPolling(reel.id, jobId, reel);
    } catch (e) {
      setAnalyzingJobs((prev) => { const next = new Map(prev); next.delete(reel.id); return next; });
      showToast(e instanceof Error ? e.message : '분석 시작에 실패했습니다', 'error');
    }
  };

  const handleToggleFavorite = async (reel: RadarReel) => {
    const isFav = favoritedReels.has(reel.id);
    if (isFav) {
      setFavoritedReels((prev) => { const next = new Set(prev); next.delete(reel.id); return next; });
      showToast('즐겨찾기에서 제거했습니다', 'info');
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
          channel_name: ch?.ig_username || reel.channel_name || '',
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

  // ─── Compare Selection ───

  const handleSelectReel = (reelId: string) => {
    setSelectedReelIds((prev) => {
      const next = new Set(prev);
      if (next.has(reelId)) {
        next.delete(reelId);
        setSelectedReelData((d) => d.filter((r) => r.id !== reelId));
      } else if (next.size < 3) {
        next.add(reelId);
      }
      return next;
    });
  };

  // Track reel data for CompareBar display (we need the actual reel objects)

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">{t('radar.title', '레이더')}</h1>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
          {t('radar.channelManage', '채널 관리')}
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-4">{t('radar.subtitle', '떡상한 영상을 찾아 분석하고 저장하세요')}</p>

      {/* 3-Tab Navigation */}
      <div className="flex items-center gap-1 mb-5 border-b border-gray-200">
        {([
          { key: 'watch' as const, label: '감시' },
          { key: 'trend' as const, label: '트렌드' },
          { key: 'search' as const, label: '검색' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabSwitch(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'watch' && (
        <WatchTab
          channels={channels}
          lastRadarVisit={lastRadarVisit}
          analyzingJobs={analyzingJobs}
          favoritedReels={favoritedReels}
          selectedReels={selectedReelIds}
          onAnalyze={handleAnalyze}
          onToggleFavorite={handleToggleFavorite}
          onSelectReel={handleSelectReel}
          onOpenChannelManager={() => setModalOpen(true)}
        />
      )}
      {activeTab === 'trend' && (
        <TrendTab
          analyzingJobs={analyzingJobs}
          favoritedReels={favoritedReels}
          selectedReels={selectedReelIds}
          onAnalyze={handleAnalyze}
          onToggleFavorite={handleToggleFavorite}
          onSelectReel={handleSelectReel}
        />
      )}
      {activeTab === 'search' && (
        <SearchTab
          analyzingJobs={analyzingJobs}
          favoritedReels={favoritedReels}
          selectedReels={selectedReelIds}
          onAnalyze={handleAnalyze}
          onToggleFavorite={handleToggleFavorite}
          onSelectReel={handleSelectReel}
        />
      )}

      {/* Compare Bar */}
      <CompareBar
        selectedReels={selectedReelData}
        onClear={() => { setSelectedReelIds(new Set()); setSelectedReelData([]); }}
        onRemove={(reelId) => {
          setSelectedReelIds((prev) => { const next = new Set(prev); next.delete(reelId); return next; });
          setSelectedReelData((prev) => prev.filter((r) => r.id !== reelId));
        }}
      />

      {/* Channel Manager Modal */}
      <ChannelManager
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        channels={channels}
        onAdd={handleAddChannel}
        onDelete={handleDeleteChannel}
        onCollect={handleCollect}
      />
    </div>
  );
}
