import type { Job, VideoRecipe } from '../types';
import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

export async function createJob(file: File): Promise<{ id: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/api/analyze`, {
    method: 'POST',
    headers: await authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '업로드에 실패했습니다' }));
    throw new Error(err.detail || '업로드에 실패했습니다');
  }
  const data = await res.json();
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

export async function getResult(id: string): Promise<VideoRecipe> {
  const res = await fetch(`${API_URL}/api/results/${id}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    throw new Error('결과를 찾을 수 없습니다');
  }
  const data = await res.json();
  return data.recipe_json;
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
