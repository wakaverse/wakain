/**
 * 소구 분석 탭 — 타임라인 + 씬카드 통합, 비주얼/텍스트 소구 분리
 */

interface Appeal {
  type: string;
  type_ko?: string;
  claim: string;
  technique?: string;
  technique_ko?: string;
  timestamp?: number;
  strength?: string;
}

interface SceneAnalysis {
  scene_index: number;
  time_range: string;
  role: string;
  attention: number;
  appeal_count: number;
  appeal_details?: Appeal[];
  text_count?: number;
  duration: number;
}

interface Props {
  scenes: SceneAnalysis[];
  duration: number;
  onSeek: (time: number) => void;
  currentTime: number;
}

const roleColors: Record<string, string> = {
  hook: 'bg-red-400', demo: 'bg-blue-400', proof: 'bg-green-400',
  solution: 'bg-purple-400', cta: 'bg-orange-400', brand_intro: 'bg-yellow-400',
  recap: 'bg-teal-400', transition: 'bg-gray-300', body: 'bg-slate-400',
  problem: 'bg-pink-400',
};

const roleLabels: Record<string, string> = {
  hook: '훅', demo: '데모', proof: '증거', solution: '솔루션',
  cta: 'CTA', brand_intro: '브랜드', recap: '정리', transition: '전환',
  body: '본문', problem: '문제',
};

const roleBadgeColors: Record<string, string> = {
  hook: 'bg-red-100 text-red-700', demo: 'bg-blue-100 text-blue-700',
  proof: 'bg-green-100 text-green-700', solution: 'bg-purple-100 text-purple-700',
  cta: 'bg-orange-100 text-orange-700', brand_intro: 'bg-yellow-100 text-yellow-700',
  recap: 'bg-teal-100 text-teal-700', transition: 'bg-gray-100 text-gray-600',
  body: 'bg-slate-100 text-slate-600', problem: 'bg-pink-100 text-pink-700',
};

const appealIcons: Record<string, string> = {
  emotional: '❤️', feature_demo: '💡', ingredient: '🥬', spec_data: '📐',
  lifestyle: '🏠', origin: '🌍', price: '💰', social_proof: '📊',
  urgency: '⏰', guarantee: '🛡', myth_bust: '🪝', manufacturing: '🏭',
  comparison: '⚖️', nostalgia: '💭', authority: '👨‍⚕️', design_aesthetic: '🎨',
  sensory: '🎵', authenticity: '🤝', track_record: '🏆',
};

function parseTimeRange(tr: string): [number, number] {
  const match = tr.match(/([\d.]+)-([\d.]+)/);
  if (match) return [parseFloat(match[1]), parseFloat(match[2])];
  return [0, 0];
}

function isVisualAppeal(a: Appeal): boolean {
  return !!a.technique && !['text_overlay', 'caption', 'narration', 'none', ''].includes(a.technique);
}

function AttentionBar({ value }: { value: number }) {
  const color = value >= 60 ? 'bg-green-500' : value >= 30 ? 'bg-amber-500' : 'bg-red-500';
  const label = value >= 60 ? '🟢' : value >= 30 ? '🟡' : '🔴';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-500 w-6 text-right">{value}</span>
    </div>
  );
}

function AppealItem({ appeal, onSeek }: { appeal: Appeal & { time: number }; onSeek: (t: number) => void }) {
  return (
    <div
      className="flex items-start gap-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded px-1.5 -mx-1.5 transition-colors"
      onClick={() => onSeek(appeal.time)}
    >
      <span className="text-sm mt-0.5">{appealIcons[appeal.type] || '📌'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-gray-400">{appeal.time.toFixed(1)}s</span>
          {appeal.technique_ko && (
            <span className="text-[11px] text-gray-400">{appeal.technique_ko}</span>
          )}
        </div>
        <p className="text-xs text-gray-700 leading-snug">{appeal.type_ko || appeal.type}: {appeal.claim}</p>
      </div>
    </div>
  );
}

export default function AppealAnalysis({ scenes, duration, onSeek, currentTime }: Props) {
  // 전체 통계
  let totalVisual = 0;
  let totalText = 0;
  scenes.forEach(s => {
    (s.appeal_details || []).forEach(a => {
      if (isVisualAppeal(a)) totalVisual++;
      else totalText++;
    });
  });

  return (
    <div className="space-y-5">
      {/* 타임라인 바 */}
      <div>
        <div className="text-xs text-gray-500 mb-1 flex justify-between">
          <span>0s</span>
          <span>{Math.round(duration / 2)}s</span>
          <span>{Math.round(duration)}s</span>
        </div>
        <div className="h-8 bg-gray-100 rounded-lg overflow-hidden relative">
          {scenes.map((s, i) => {
            const [start, end] = parseTimeRange(s.time_range);
            const width = ((end - start) / duration) * 100;
            const left = (start / duration) * 100;
            const isActive = currentTime >= start && currentTime < end;
            return (
              <div
                key={i}
                className={`absolute h-full cursor-pointer hover:opacity-80 transition-opacity ${roleColors[s.role] || 'bg-gray-300'} ${isActive ? 'ring-2 ring-blue-600 z-10' : ''}`}
                style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
                onClick={() => onSeek(start)}
                title={`${roleLabels[s.role] || s.role} (${start.toFixed(1)}-${end.toFixed(1)}s)`}
              />
            );
          })}
          <div
            className="absolute top-0 h-full w-0.5 bg-red-600 z-20"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          />
        </div>
        {/* 범례 */}
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(roleLabels).filter(([k]) => scenes.some(s => s.role === k)).map(([key, label]) => (
            <span key={key} className="flex items-center gap-1 text-[11px] text-gray-500">
              <span className={`w-2.5 h-2.5 rounded ${roleColors[key]}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* 소구 요약 */}
      <div className="flex gap-3">
        <div className="flex-1 bg-blue-50 rounded-lg px-3 py-2 text-center">
          <div className="text-lg font-bold text-blue-700">{totalVisual}</div>
          <div className="text-[11px] text-blue-500">🎬 비주얼 소구</div>
        </div>
        <div className="flex-1 bg-amber-50 rounded-lg px-3 py-2 text-center">
          <div className="text-lg font-bold text-amber-700">{totalText}</div>
          <div className="text-[11px] text-amber-500">📝 텍스트 소구</div>
        </div>
        <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-center">
          <div className="text-lg font-bold text-gray-700">{scenes.length}</div>
          <div className="text-[11px] text-gray-500">🎬 씬</div>
        </div>
      </div>

      {/* 씬 카드 + 소구 분리 */}
      <div className="space-y-3">
        {scenes.map((s) => {
          const [start] = parseTimeRange(s.time_range);
          const isActive = currentTime >= start && currentTime < start + s.duration;
          const appeals = (s.appeal_details || []).map(a => ({
            ...a,
            time: a.timestamp ?? start,
          }));
          const visualAppeals = appeals.filter(a => isVisualAppeal(a));
          const textAppeals = appeals.filter(a => !isVisualAppeal(a));
          const hasAppeals = visualAppeals.length > 0 || textAppeals.length > 0;

          return (
            <div
              key={s.scene_index}
              className={`rounded-xl border transition-all ${isActive ? 'ring-2 ring-blue-500 bg-blue-50/20' : 'bg-white'}`}
            >
              {/* 씬 헤더 */}
              <div
                className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
                onClick={() => onSeek(start)}
              >
                <span className="text-xs font-bold text-gray-300">#{s.scene_index}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${roleBadgeColors[s.role] || 'bg-gray-100 text-gray-600'}`}>
                  {roleLabels[s.role] || s.role}
                </span>
                <span className="text-[11px] text-gray-400">{s.time_range}</span>
                <span className="text-[11px] text-gray-400">({s.duration.toFixed(1)}s)</span>
                <div className="ml-auto flex items-center gap-2">
                  {visualAppeals.length > 0 && (
                    <span className="text-[11px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">🎬 {visualAppeals.length}</span>
                  )}
                  {textAppeals.length > 0 && (
                    <span className="text-[11px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">📝 {textAppeals.length}</span>
                  )}
                </div>
              </div>

              {/* 집중도 바 */}
              <div className="px-4 pb-2">
                <AttentionBar value={s.attention} />
              </div>

              {/* 소구 상세 — 비주얼/텍스트 분리 */}
              {hasAppeals && (
                <div className="px-4 pb-3 space-y-2">
                  {visualAppeals.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-blue-600 mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        비주얼 소구
                      </div>
                      <div className="border-l-2 border-blue-200 pl-2 space-y-0.5">
                        {visualAppeals.map((a, i) => (
                          <AppealItem key={i} appeal={a} onSeek={onSeek} />
                        ))}
                      </div>
                    </div>
                  )}
                  {textAppeals.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-amber-600 mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        텍스트(대본) 소구
                      </div>
                      <div className="border-l-2 border-amber-200 pl-2 space-y-0.5">
                        {textAppeals.map((a, i) => (
                          <AppealItem key={i} appeal={a} onSeek={onSeek} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 소구 없는 씬 */}
              {!hasAppeals && (
                <div className="px-4 pb-3 text-[11px] text-gray-300 italic">
                  감지된 소구 없음
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
