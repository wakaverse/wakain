import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Sparkles, ArrowRight, Copy, Check, X, AlertTriangle } from 'lucide-react';
import { getResult, generateScript } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { RecipeJSON, EvalImprovement, SegmentEval } from '../types/recipe';

/* ── Helpers ──────────────────────────────── */

function PriorityBadge({ priority }: { priority?: string }) {
  if (!priority) return null;
  const colors: Record<string, string> = {
    high: 'bg-red-50 text-red-600',
    medium: 'bg-amber-50 text-amber-600',
    low: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colors[priority] || colors.medium}`}>
      {priority}
    </span>
  );
}

function SegmentCard({ label, segment }: { label: string; segment?: SegmentEval }) {
  if (!segment) return null;
  const hasImprovements = segment.improvements && segment.improvements.length > 0;
  return (
    <div className="bg-gray-50 rounded-xl p-3 space-y-2">
      <p className="text-xs font-semibold text-gray-900 uppercase tracking-wide">{label}</p>
      {segment.time_range && (
        <p className="text-[11px] text-gray-400">{segment.time_range[0]}s – {segment.time_range[1]}s</p>
      )}
      {segment.strengths?.map((s, i) => (
        <div key={`s-${i}`} className="text-xs text-gray-600">
          <span className="text-emerald-500 mr-1">✓</span>{s.fact}
        </div>
      ))}
      {hasImprovements && segment.improvements.map((imp, i) => (
        <div key={`i-${i}`} className="text-xs text-gray-600">
          <span className="text-amber-500 mr-1">→</span>{imp.suggestion}
        </div>
      ))}
    </div>
  );
}

/* ── Script Modal ─────────────────────────── */

function ScriptModal({ script, onClose }: { script: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">대본 초안</p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '복사됨' : '복사'}
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
            {script}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────── */

export default function GuideReportPage() {
  const { resultId } = useParams<{ resultId: string }>();
  const [recipe, setRecipe] = useState<RecipeJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Script generation
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptText, setScriptText] = useState<string | null>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);

  useEffect(() => {
    if (!resultId) return;
    setLoading(true);
    getResult(resultId)
      .then((data) => {
        setRecipe(data.recipe);
        // Log guide_generate event
        supabase.auth.getSession().then(({ data: s }) => {
          const uid = s.session?.user?.id;
          if (uid) {
            supabase.from('user_activity_logs').insert({
              user_id: uid, action: 'guide_generate',
              metadata: { result_id: resultId },
            }).then(() => {});
          }
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [resultId]);

  const handleGenerateScript = async () => {
    if (!resultId) return;
    setScriptLoading(true);
    setScriptError(null);
    try {
      const { script } = await generateScript(resultId);
      setScriptText(script);
    } catch (e: any) {
      setScriptError(e.message || '대본 생성에 실패했습니다');
    } finally {
      setScriptLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">{error || '결과를 찾을 수 없습니다'}</p>
      </div>
    );
  }

  const evaluation = recipe.evaluation;
  if (!evaluation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertTriangle className="w-8 h-8 text-gray-300 mb-3" />
        <p className="text-gray-500">평가 데이터가 없습니다</p>
      </div>
    );
  }

  const { structure, recipe_eval, improvements } = evaluation;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <p className="text-lg font-bold text-gray-900">제작가이드 리포트</p>
        <p className="text-sm text-gray-500 mt-1">
          {recipe.identity?.name || recipe.product?.name} · {recipe.identity?.brand}
        </p>
      </div>

      {/* Section 1: 구조 개선 */}
      <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="text-sm font-semibold text-gray-900">구조 개선</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <SegmentCard label="Hook" segment={structure?.hook} />
          <SegmentCard label="Body" segment={structure?.body} />
          <SegmentCard label="CTA" segment={structure?.cta} />
        </div>
      </section>

      {/* Section 2: 레시피 리팩토링 */}
      <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="text-sm font-semibold text-gray-900">레시피 리팩토링</p>
        {recipe_eval && (
          <div className="flex items-start gap-4">
            {/* 현재 */}
            <div className="flex-1 bg-gray-50 rounded-xl p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">현재</p>
              {recipe_eval.current?.map((block, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-4 h-4 rounded-full bg-gray-200 text-[10px] flex items-center justify-center font-medium text-gray-500">
                    {i + 1}
                  </span>
                  {block}
                </div>
              ))}
            </div>

            <ArrowRight className="w-4 h-4 text-gray-300 mt-6 shrink-0" />

            {/* 제안 */}
            <div className="flex-1 bg-blue-50/60 rounded-xl p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide">제안</p>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {recipe_eval.suggestion}
              </p>
            </div>
          </div>
        )}
        {recipe_eval?.reason && (
          <p className="text-xs text-gray-500 mt-2">{recipe_eval.reason}</p>
        )}
      </section>

      {/* Section 3: 핵심 개선 */}
      <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-900">핵심 개선</p>
        {improvements && improvements.length > 0 ? (
          <div className="space-y-3">
            {improvements.map((imp: EvalImprovement, i: number) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={(imp as any).priority} />
                  <p className="text-xs text-gray-500">{imp.fact}</p>
                </div>
                <p className="text-xs text-gray-800 font-medium">{imp.suggestion}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">개선 사항이 없습니다</p>
        )}
      </section>

      {/* Script Generation Button */}
      <div className="flex flex-col items-center gap-2 pb-8">
        <button
          onClick={handleGenerateScript}
          disabled={scriptLoading}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {scriptLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {scriptLoading ? '대본 생성 중...' : '대본 생성'}
        </button>
        {scriptError && (
          <p className="text-xs text-red-500">{scriptError}</p>
        )}
      </div>

      {/* Script Modal */}
      {scriptText && (
        <ScriptModal script={scriptText} onClose={() => setScriptText(null)} />
      )}
    </div>
  );
}
