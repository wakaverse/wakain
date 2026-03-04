import type { AnalysisResult } from '../../types';

const TECHNIQUE_KO: Record<string, string> = {
  closeup: '클로즈업',
  package_shot: '패키지',
  package_focus: '패키지',
  in_use_demo: '시연',
  texture_detail: '질감',
  steam_sizzle: '스팀/지글',
  slow_motion: '슬로우모션',
  zoom_in: '줌인',
  before_after: '비포애프터',
  process_shot: '공정',
  reaction_shot: '리액션',
  ingredient_shot: '성분',
  ingredient_breakdown: '성분',
  multi_angle: '다각도',
  pour_drip: '붓기',
  size_comparison: '크기비교',
  rotation: '회전',
  unboxing: '언박싱',
  spotlight: '스팟라이트',
};

const CUT_PATTERN_KO: Record<string, string> = {
  accelerating: '가속 패턴',
  decelerating: '감속 패턴',
  constant: '일정 패턴',
  irregular: '불규칙 패턴',
};

const PRESENTER_KO: Record<string, string> = {
  narrator: '내레이터',
  expert: '전문가',
  reviewer: '리뷰어',
  founder: '창업자',
  customer: '고객',
  celebrity: '셀럽',
  character: '캐릭터',
  none: '없음',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-20 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 flex flex-wrap gap-1.5 items-center min-w-0">{children}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-[11px] px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">
      {children}
    </span>
  );
}

interface Props {
  result: AnalysisResult;
}

export default function VideoStructure({ result }: Props) {
  const recipe = result.video_recipe?.video_recipe;
  const temporal = result.temporal;
  const pa = recipe?.persuasion_analysis;
  const structure = recipe?.structure;
  const meta = recipe?.meta;

  if (!recipe) return null;

  // Edit rhythm
  const avgCut = temporal?.cut_rhythm?.avg_interval ?? recipe.visual_style?.avg_cut_interval;
  const cutPattern = temporal?.cut_rhythm?.pattern;
  const totalCuts = structure?.scene_sequence?.length || recipe.visual_style?.total_cuts || 0;

  const paAny = pa as any;

  // Product exposure
  const productRatioRaw =
    recipe.visual_style?.product_screen_time_ratio ??
    (recipe.performance_metrics?.product_focus_ratio != null
      ? (recipe.performance_metrics.product_focus_ratio > 1
          ? recipe.performance_metrics.product_focus_ratio / 100
          : recipe.performance_metrics.product_focus_ratio)
      : null);
  const productPct = productRatioRaw != null ? Math.round(productRatioRaw * 100) : null;
  const firstAppear = paAny?.product_emphasis?.first_appear ?? structure?.product_first_appear;

  // Emphasis techniques
  const emphasisTechs: string[] = Array.from(
    new Set([
      ...(paAny?.product_emphasis?.emphasis_techniques ?? []),
      ...(pa?.appeal_points ?? [])
        .map((a: any) => a.visual_proof?.technique as string)
        .filter((t: string) => t && t !== 'none'),
    ])
  );

  // Presenter
  const presenterType = pa?.presenter?.type || '';
  const faceShown = pa?.presenter?.face_shown;

  const duration = meta?.duration ?? 0;

  if (!avgCut && !productPct && !presenterType) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-sm font-semibold text-gray-900 mb-4">🎬 영상 구조</p>

      <div>
        {(avgCut != null || totalCuts > 0) && (
          <Row label="편집">
            <span className="text-sm text-gray-700">
              {avgCut != null ? `평균 ${Number(avgCut).toFixed(1)}초/컷` : ''}
              {avgCut != null && totalCuts > 0 ? ' · ' : ''}
              {totalCuts > 0 ? `${totalCuts}컷` : ''}
              {cutPattern && ` · ${CUT_PATTERN_KO[cutPattern] || cutPattern}`}
            </span>
          </Row>
        )}

        {(productPct != null || firstAppear != null) && (
          <Row label="제품 노출">
            <span className="text-sm text-gray-700">
              {productPct != null ? `${productPct}%` : ''}
              {productPct != null && firstAppear != null ? ' · ' : ''}
              {firstAppear != null ? `첫 등장 ${Math.round(firstAppear)}초` : ''}
            </span>
          </Row>
        )}

        {emphasisTechs.length > 0 && (
          <Row label="강조 기법">
            {emphasisTechs.slice(0, 5).map((t) => (
              <Pill key={t}>{TECHNIQUE_KO[t] || t}</Pill>
            ))}
          </Row>
        )}

        {presenterType && presenterType !== 'none' && (
          <Row label="사람">
            <span className="text-sm text-gray-700">
              {PRESENTER_KO[presenterType] || presenterType}
              {faceShown != null ? (faceShown ? ' · 얼굴 노출' : ' · 얼굴 비노출') : ''}
            </span>
          </Row>
        )}

        {duration > 0 && (
          <Row label="길이">
            <span className="text-sm text-gray-700">{Math.round(duration)}초</span>
          </Row>
        )}
      </div>
    </div>
  );
}
