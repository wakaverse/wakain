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
    video_url: data.video_url || null,
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

export { API_URL };
