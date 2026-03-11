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
  hook: '첫 장면',
  authority: '전문가/신뢰',
  benefit: '장점 소개',
  proof: '증거/근거',
  differentiation: '차별점',
  social_proof: '후기/반응',
  cta: '행동 유도',
  pain_point: '문제/공감',
  demo: '시연/사용법',
  promotion: '할인/혜택',
};

export const BLOCK_BORDER_COLORS: Record<string, string> = {
  hook: '#E03E3E',
  authority: '#9065E0',
  benefit: '#2383E2',
  proof: '#0F7B6C',
  differentiation: '#6940A5',
  social_proof: '#DFAB01',
  cta: '#D9730D',
  pain_point: '#DC2626',
  demo: '#059669',
  promotion: '#F97316',
};

export const BLOCK_HEX = BLOCK_BORDER_COLORS;

// Evaluation-specific block colors (brighter palette)
export const BLOCK_EVAL_COLORS: Record<string, string> = {
  hook: '#EF4444',
  benefit: '#3B82F6',
  proof: '#10B981',
  differentiation: '#8B5CF6',
  social_proof: '#F59E0B',
  cta: '#EC4899',
  authority: '#6366f1',
  pain_point: '#DC2626',
  demo: '#059669',
  promotion: '#F97316',
};

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

// ─── Korean label mappings ───

export const STYLE_LABELS: Record<string, string> = {
  demo: '데모',
  review: '리뷰',
  problem_solution: '문제해결',
  before_after: '전후비교',
  story: '스토리',
  listicle: '리스트',
  trend_ride: '트렌드',
  promotion: '프로모션',
  sensory: '감성',
};

export const ENERGY_LABELS: Record<string, string> = {
  decelerating: '감속형',
  building: '상승형',
  peak: '정점형',
  fade: '페이드',
  sustain: '유지형',
  accelerating: '가속형',
  climax: '클라이맥스',
  flat: '평탄형',
  wave: '파동형',
};

export const ALPHA_EMOTION_LABELS: Record<string, string> = {
  fomo: 'FOMO',
  relief: '안도감',
  anticipation: '기대감',
  curiosity: '호기심',
  surprise: '놀라움',
  empathy: '공감',
  fear: '공포',
  joy: '기쁨',
  trust: '신뢰',
  urgency: '긴박감',
};

export const ALPHA_STRUCTURE_LABELS: Record<string, string> = {
  info_density: '정보밀도',
  problem_solution: '문제해결',
  contrast: '대비',
  repetition: '반복',
  escalation: '고조',
  pattern_break: '패턴전환',
  before_after: '전후비교',
  list: '나열',
};

export const ALPHA_CONNECTION_LABELS: Record<string, string> = {
  social_proof: '사회적증거',
  authority: '권위',
  relatability: '공감대',
  community: '커뮤니티',
  testimony: '증언',
  question: '질문',
  direct_address: '직접호칭',
};

export const BLOCK_SUBTYPE_LABELS: Record<string, string> = {
  emotional: '감성',
  functional: '기능',
  process: '프로세스',
  comparative: '비교',
  social: '사회적',
  visual: '시각적',
  question: '질문형',
  statement: '선언형',
  action: '행동형',
  statistic: '통계',
  story: '스토리',
  direct: '직접',
};

export const HOOK_STRENGTH_LABELS: Record<string, string> = {
  strong: '강력',
  medium: '보통',
  weak: '약함',
};

export const RISK_LEVEL_LABELS: Record<string, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
};

export function labelKo(key: string, map?: Record<string, string>): string {
  if (map && map[key]) return map[key];
  const allMaps = [
    STYLE_LABELS, ENERGY_LABELS, ALPHA_EMOTION_LABELS,
    ALPHA_STRUCTURE_LABELS, ALPHA_CONNECTION_LABELS,
    BLOCK_LABELS, BLOCK_SUBTYPE_LABELS,
  ];
  for (const m of allMaps) {
    if (m[key]) return m[key];
  }
  return key.replace(/_/g, ' ');
}

// ─── Alpha colors ───

export const ALPHA_COLORS: Record<string, { icon: string; bg: string; text: string }> = {
  emotion: { icon: '😊', bg: 'bg-pink-50', text: 'text-pink-700' },
  structure: { icon: '🔲', bg: 'bg-sky-50', text: 'text-sky-700' },
  connection: { icon: '🔗', bg: 'bg-amber-50', text: 'text-amber-700' },
};
