import type { Job, AnalysisResult } from '../types';
import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

/**
 * Upload file to R2 via presigned URL, then start analysis.
 * onProgress fires with 0-100 during the R2 upload phase.
 */
export async function createJob(
  file: File,
  onProgress?: (percent: number) => void,
  productName?: string,
  productCategory?: string,
): Promise<{ id: string }> {
  const headers = await authHeaders();

  // 1. Get presigned upload URL from backend
  const urlRes = await fetch(`${API_URL}/api/upload-url`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      content_type: file.type || 'video/mp4',
    }),
  });
  if (!urlRes.ok) {
    const err = await urlRes.json().catch(() => ({ detail: '업로드 URL 발급에 실패했습니다' }));
    throw new Error(err.detail || '업로드 URL 발급에 실패했습니다');
  }
  const { upload_url, r2_key } = await urlRes.json();

  // 2. Upload file directly to R2 via presigned URL (with progress)
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', upload_url);
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`R2 업로드 실패 (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('R2 업로드 중 네트워크 오류'));
    xhr.send(file);
  });

  // 3. Start analysis with R2 key
  const analyzeRes = await fetch(`${API_URL}/api/analyze`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      r2_key,
      filename: file.name,
      file_size_mb: file.size / (1024 * 1024),
      product_name: productName || null,
      product_category: productCategory || null,
    }),
  });
  if (!analyzeRes.ok) {
    const err = await analyzeRes.json().catch(() => ({ detail: '분석 시작에 실패했습니다' }));
    throw new Error(err.detail || '분석 시작에 실패했습니다');
  }
  const data = await analyzeRes.json();
  return { id: data.job_id };
}

export async function getJob(id: string): Promise<Job> {
  const res = await fetch(`${API_URL}/api/jobs/${id}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    throw new Error('작업을 찾을 수 없습니다');
  }
  return res.json();
}

/**
 * Start analysis from a video URL (server-side download).
 */
export async function createJobFromUrl(
  videoUrl: string,
  productName?: string,
  productCategory?: string,
  meta?: { title?: string; thumbnail_url?: string; channel_name?: string; source_url?: string; posted_at?: string },
): Promise<{ id: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/api/analyze-url`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_url: videoUrl,
      product_name: productName || null,
      product_category: productCategory || null,
      ...(meta || {}),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'URL 분석 시작에 실패했습니다' }));
    throw new Error(err.detail || 'URL 분석 시작에 실패했습니다');
  }
  const data = await res.json();
  return { id: data.job_id };
}

export async function getResult(id: string): Promise<AnalysisResult> {
  const res = await fetch(`${API_URL}/api/results/${id}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    throw new Error('결과를 찾을 수 없습니다');
  }
  const data = await res.json();
  return {
    video_recipe: data.recipe_json,
    diagnosis: data.diagnosis_json || null,
    prescriptions: data.prescriptions_json || null,
    stt: data.stt_json || null,
    style: data.style_json || null,
    caption_map: data.caption_map_json || null,
    verdict: data.verdict_json || null,
    video_url: data.video_url || null,
    appeal_structure: data.appeal_structure_json || null,
    product: data.product_json || null,
    thumbnails: data.thumbnails || {},
    persuasion_lens: data.persuasion_lens_json || null,
  };
}

export async function listJobs(): Promise<Job[]> {
  const res = await fetch(`${API_URL}/api/jobs`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    throw new Error('작업 목록을 불러올 수 없습니다');
  }
  return res.json();
}

export async function getJobStatus(jobId: string): Promise<{ status: string; id: string }> {
  const res = await fetch(`${API_URL}/api/jobs/${jobId}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to get job status');
  return res.json();
}

export { API_URL };

// ─── Radar API ───

import type { RadarChannel, RadarReel, RadarFilters } from '../types';

export async function getRadarChannels(): Promise<RadarChannel[]> {
  const res = await fetch(`${API_URL}/api/radar/channels`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error('채널 목록을 불러올 수 없습니다');
  return res.json();
}

export async function addRadarChannel(
  ig_username: string,
  category: string,
  platform: string = 'instagram',
): Promise<RadarChannel> {
  const res = await fetch(`${API_URL}/api/radar/channels`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ig_username, category, platform }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '채널 등록에 실패했습니다' }));
    throw new Error(err.detail || '채널 등록에 실패했습니다');
  }
  return res.json();
}

export async function deleteRadarChannel(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/radar/channels/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error('채널 삭제에 실패했습니다');
}

export async function getRadarFeed(
  filters: RadarFilters,
): Promise<{ reels: RadarReel[]; total: number }> {
  const params = new URLSearchParams();
  if (filters.channel_id) params.set('channel_id', filters.channel_id);
  if (filters.platform) params.set('platform', filters.platform);
  if (filters.period) params.set('period', filters.period);
  if (filters.min_spike) params.set('min_spike', String(filters.min_spike));
  if (filters.min_views) params.set('min_views', String(filters.min_views));
  if (filters.min_engagement) params.set('min_engagement', String(filters.min_engagement));
  if (filters.keyword) params.set('keyword', filters.keyword);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const res = await fetch(`${API_URL}/api/radar/feed?${params}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error('피드를 불러올 수 없습니다');
  return res.json();
}

export async function collectChannel(channelId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/radar/collect/${channelId}`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error('수집에 실패했습니다');
}

// ─── Library API ───

import type { LibraryItem, LibraryFilters } from '../types';

export async function getLibraryItems(
  filters: LibraryFilters,
): Promise<{ items: LibraryItem[]; total: number }> {
  const params = new URLSearchParams();
  if (filters.source) params.set('source', filters.source);
  if (filters.platform) params.set('platform', filters.platform);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.keyword) params.set('keyword', filters.keyword);
  if (filters.starred) params.set('starred', 'true');
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const res = await fetch(`${API_URL}/api/library/items?${params}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error('라이브러리를 불러올 수 없습니다');
  return res.json();
}

export async function addLibraryItem(item: Partial<LibraryItem>): Promise<LibraryItem> {
  const res = await fetch(`${API_URL}/api/library/items`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error('라이브러리에 추가할 수 없습니다');
  return res.json();
}

export async function updateLibraryItem(
  id: string,
  updates: Partial<LibraryItem>,
): Promise<LibraryItem> {
  const res = await fetch(`${API_URL}/api/library/items/${id}`, {
    method: 'PATCH',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('업데이트에 실패했습니다');
  return res.json();
}

export async function deleteLibraryItem(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/library/items/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error('삭제에 실패했습니다');
}
