interface Appeal {
  type: string;
  type_ko?: string;
  claim: string;
  technique?: string;
  technique_ko?: string;
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
  onSeek: (time: number) => void;
  currentTime: number;
}

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

function parseStart(tr: string): number {
  const match = tr.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

function AttentionBar({ value }: { value: number }) {
  const color = value >= 60 ? 'bg-green-500' : value >= 30 ? 'bg-amber-500' : 'bg-red-500';
  const label = value >= 60 ? '🟢' : value >= 30 ? '🟡' : '🔴';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-600 w-6 text-right">{value}</span>
    </div>
  );
}

export default function SceneCards({ scenes, onSeek, currentTime }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {scenes.map((s) => {
        const start = parseStart(s.time_range);
        const isActive = currentTime >= start && currentTime < start + s.duration;
        return (
          <div
            key={s.scene_index}
            className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${isActive ? 'ring-2 ring-blue-500 bg-blue-50/30' : 'bg-white'}`}
            onClick={() => onSeek(start)}
          >
            {/* 헤더 */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-gray-400">#{s.scene_index}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${roleBadgeColors[s.role] || 'bg-gray-100 text-gray-600'}`}>
                {roleLabels[s.role] || s.role}
              </span>
              <span className="text-xs text-gray-400 ml-auto">{s.time_range}</span>
            </div>

            {/* 집중도 */}
            <AttentionBar value={s.attention} />

            {/* 소구 포인트 */}
            {s.appeal_details && s.appeal_details.length > 0 && (
              <div className="mt-2 space-y-1">
                {s.appeal_details.map((a, i) => {
                  const isVisual = a.technique && !['text_overlay', 'none', ''].includes(a.technique);
                  return (
                    <div key={i} className="text-xs text-gray-600 flex items-center gap-1">
                      <span>{isVisual ? '🎬' : '📝'}</span>
                      <span className="font-medium">{a.type_ko || a.type}</span>
                      <span className="text-gray-400 truncate">— {a.claim}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 텍스트 효과 */}
            {(s.text_count ?? 0) > 0 && (
              <div className="mt-1 text-xs text-gray-400">
                텍스트 효과 {s.text_count}개
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
