// ─── V2 Recipe utility functions & color constants ───

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatTimeRange(range: [number, number]): string {
  return `${formatTime(range[0])}-${formatTime(range[1])}`;
}

// ─── Block colors ───

export const BLOCK_LABELS: Record<string, string> = {
  hook: '훅',
  authority: '권위',
  benefit: '베네핏',
  proof: '입증',
  differentiation: '차별화',
  social_proof: '사회적증거',
  cta: 'CTA',
};

export const BLOCK_BORDER_COLORS: Record<string, string> = {
  hook: '#E03E3E',
  authority: '#9065E0',
  benefit: '#2383E2',
  proof: '#0F7B6C',
  differentiation: '#6940A5',
  social_proof: '#DFAB01',
  cta: '#D9730D',
};

export const BLOCK_HEX = BLOCK_BORDER_COLORS;

// ─── Style colors ───

export const STYLE_BAR_COLORS: Record<string, string> = {
  demo: '#2383E2',
  review: '#0F7B6C',
  problem_solution: '#9065E0',
  before_after: '#E03E3E',
  story: '#D9730D',
  listicle: '#DFAB01',
  trend_ride: '#6940A5',
  promotion: '#CB912F',
  sensory: '#448361',
};

export const STYLE_COLORS: Record<string, { bg: string; text: string }> = {
  demo: { bg: 'bg-blue-50', text: 'text-blue-700' },
  review: { bg: 'bg-teal-50', text: 'text-teal-700' },
  problem_solution: { bg: 'bg-purple-50', text: 'text-purple-700' },
  before_after: { bg: 'bg-red-50', text: 'text-red-700' },
  story: { bg: 'bg-orange-50', text: 'text-orange-700' },
  listicle: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  trend_ride: { bg: 'bg-violet-50', text: 'text-violet-700' },
  promotion: { bg: 'bg-amber-50', text: 'text-amber-700' },
  sensory: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
};

// ─── Claim type info ───

export const CLAIM_TYPE_INFO: Record<string, { label: string; icon: string }> = {
  composition: { label: '성분/원료', icon: '🧬' },
  function: { label: '기능/효과', icon: '⚡' },
  experience: { label: '체험/후기', icon: '💬' },
  trust: { label: '신뢰/권위', icon: '🏅' },
  value: { label: '가격/가치', icon: '💰' },
  comparison: { label: '비교/차별', icon: '🔄' },
};

// ─── Alpha colors ───

export const ALPHA_COLORS: Record<string, { icon: string; bg: string; text: string }> = {
  emotion: { icon: '😊', bg: 'bg-pink-50', text: 'text-pink-700' },
  structure: { icon: '🔲', bg: 'bg-sky-50', text: 'text-sky-700' },
  connection: { icon: '🔗', bg: 'bg-amber-50', text: 'text-amber-700' },
};
