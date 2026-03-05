import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, BarChart3, Sparkles, ArrowRight } from 'lucide-react';
import { getInsightCategories, getInsightCategory } from '../lib/api';

interface CategorySummary {
  category: string;
  count: number;
}

interface AppealItem {
  type: string;
  label: string;
  count: number;
  percentage: number;
}

interface ElementItem {
  element: string;
  label: string;
  count: number;
  percentage: number;
}

interface FlowPattern {
  flow: string;
  count: number;
}

interface AlphaTech {
  type: string;
  label: string;
  count: number;
}

interface SampleVideo {
  job_id: string;
  product_name: string;
  title: string;
}

interface CategoryDetail {
  category: string;
  video_count: number;
  appeal_distribution: AppealItem[];
  element_usage: ElementItem[];
  flow_patterns: FlowPattern[];
  alpha_techniques: {
    emotion: AlphaTech[];
    structure: AlphaTech[];
    connection: AlphaTech[];
  };
  sample_videos: SampleVideo[];
}

function HBar({ label, percentage, count }: { label: string; percentage: number; count: number }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-gray-600 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
        <div
          className="h-full bg-gray-800 rounded-full transition-all duration-500"
          style={{ width: `${Math.max(percentage, 2)}%` }}
        />
      </div>
      <span className="w-16 text-right text-gray-500 shrink-0 text-xs">
        {percentage}% ({count})
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {children}
    </div>
  );
}

export default function InsightsPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<CategoryDetail | null>(null);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    getInsightCategories()
      .then((data) => {
        setCategories(data);
        if (data.length > 0) {
          setSelected(data[0].category);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingCats(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoadingDetail(true);
    setDetail(null);
    getInsightCategory(selected)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setLoadingDetail(false));
  }, [selected]);

  if (loadingCats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400 text-sm">
        분석된 영상이 없습니다. 먼저 영상을 분석해주세요.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          카테고리 인사이트
        </h1>
        <p className="text-sm text-gray-500 mt-1">카테고리별 잘 먹히는 패턴을 한눈에</p>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.category}
            onClick={() => setSelected(cat.category)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selected === cat.category
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
            }`}
          >
            {cat.category} <span className="text-xs opacity-70">{cat.count}</span>
          </button>
        ))}
      </div>

      {/* Detail */}
      {loadingDetail && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      )}

      {detail && !loadingDetail && (
        <div className="space-y-4">
          {/* Appeal distribution */}
          <Section title="소구 분포">
            <div className="space-y-2">
              {detail.appeal_distribution.slice(0, 10).map((a) => (
                <HBar key={a.type} label={a.label} percentage={a.percentage} count={a.count} />
              ))}
            </div>
          </Section>

          {/* 7 elements */}
          <Section title="7요소 사용률">
            <div className="space-y-2">
              {detail.element_usage.map((e) => (
                <HBar key={e.element} label={e.label} percentage={e.percentage} count={e.count} />
              ))}
            </div>
          </Section>

          {/* Flow patterns */}
          {detail.flow_patterns.length > 0 && (
            <Section title="대표 배치 패턴 TOP">
              <div className="space-y-2">
                {detail.flow_patterns.map((fp, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-gray-700 font-mono text-xs">{fp.flow}</span>
                    <span className="text-gray-400 text-xs">{fp.count}건</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Alpha techniques */}
          {(detail.alpha_techniques.emotion.length > 0 ||
            detail.alpha_techniques.structure.length > 0 ||
            detail.alpha_techniques.connection.length > 0) && (
            <Section title="α 기법">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(['emotion', 'structure', 'connection'] as const).map((layer) => {
                  const techs = detail.alpha_techniques[layer];
                  if (techs.length === 0) return null;
                  const layerLabel = { emotion: '감정', structure: '구조', connection: '연결' }[layer];
                  return (
                    <div key={layer} className="space-y-2">
                      <div className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {layerLabel}
                      </div>
                      {techs.slice(0, 5).map((t) => (
                        <div key={t.type} className="flex items-center justify-between text-xs text-gray-600">
                          <span>{t.label}</span>
                          <span className="text-gray-400">{t.count}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Sample videos */}
          {detail.sample_videos.length > 0 && (
            <Section title={`샘플 영상 (${detail.video_count}건 중 ${detail.sample_videos.length}건)`}>
              <div className="space-y-1">
                {detail.sample_videos.map((v) => (
                  <button
                    key={v.job_id}
                    onClick={() => navigate(`/app/results/${v.job_id}`)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                  >
                    <span className="flex-1 text-sm text-gray-700 truncate">{v.product_name || v.title || '무제'}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 shrink-0" />
                  </button>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
