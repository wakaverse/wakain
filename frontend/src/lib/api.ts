import type { Job, VideoRecipe } from '../types';
import sampleRecipe from '../data/sample_recipe.json';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Mock jobs for dashboard
const mockJobs: Job[] = [
  {
    id: 'demo-001',
    status: 'completed',
    video_name: '태풍김_숏폼광고.mp4',
    video_size_mb: 18.4,
    duration_sec: 29,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    completed_at: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
  },
  {
    id: 'demo-002',
    status: 'processing',
    video_name: '신제품_런칭영상.mp4',
    video_size_mb: 45.2,
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    started_at: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
  },
  {
    id: 'demo-003',
    status: 'pending',
    video_name: '여름_캠페인.mov',
    video_size_mb: 72.1,
    created_at: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
  },
  {
    id: 'demo-004',
    status: 'failed',
    video_name: '대용량_파일.mp4',
    video_size_mb: 98.5,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    error_message: '영상 처리 중 오류가 발생했습니다.',
  },
];

export async function createJob(_file: File): Promise<{ id: string }> {
  // In production: upload to R2 and call backend
  // For demo: return a mock job id
  await new Promise((r) => setTimeout(r, 1500));
  return { id: 'demo-001' };
}

export async function getJob(id: string): Promise<Job> {
  await new Promise((r) => setTimeout(r, 300));

  if (id === 'demo-001') {
    return mockJobs[0];
  }
  if (id === 'demo-002') {
    return mockJobs[1];
  }

  // Simulate a job that completes after polling
  const created = new Date(Date.now() - 5000).toISOString();
  return {
    id,
    status: 'completed',
    video_name: '분석중인 영상.mp4',
    video_size_mb: 20,
    created_at: created,
    completed_at: new Date().toISOString(),
  };
}

export async function getResult(_id: string): Promise<VideoRecipe> {
  await new Promise((r) => setTimeout(r, 300));
  // Return the sample recipe for all demo results
  return sampleRecipe as unknown as VideoRecipe;
}

export async function listJobs(): Promise<Job[]> {
  await new Promise((r) => setTimeout(r, 300));
  return mockJobs;
}

export { API_URL };
